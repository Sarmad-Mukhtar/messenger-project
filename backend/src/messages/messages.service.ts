import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CeleryService } from '../celery/celery.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly celeryService: CeleryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // =========================================================
  // 1. Send a message
  // =========================================================

  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
    replyToId?: string,
    attachments?: {
      fileName: string;
      fileUrl: string;
      mimeType: string;
      fileSize: number;
    }[],
  ) {
    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot send a message to yourself',
      );
    }

    const trimmedContent = content?.trim() ?? '';

    if (
      !trimmedContent &&
      (!attachments || attachments.length === 0)
    ) {
      throw new BadRequestException(
        'Message content or attachment is required',
      );
    }

    const receiver =
      await this.prisma.user.findUnique({
        where: {
          id: receiverId,
        },
      });

    if (!receiver) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const sender =
      await this.prisma.user.findUnique({
        where: {
          id: senderId,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      });

    if (!sender) {
      throw new NotFoundException(
        'Sender not found',
      );
    }

    // =======================================================
    // Check whether either user has blocked the other.
    // =======================================================

    const block =
      await this.prisma.blockedUser.findFirst({
        where: {
          OR: [
            {
              blockerId: senderId,
              blockedId: receiverId,
            },
            {
              blockerId: receiverId,
              blockedId: senderId,
            },
          ],
        },
      });

    if (block) {
      throw new BadRequestException(
        'You cannot send messages to a blocked user',
      );
    }

    // =======================================================
    // Check friendship.
    // =======================================================

    const friendship =
      await this.prisma.friendRequest.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            {
              senderId,
              receiverId,
            },
            {
              senderId: receiverId,
              receiverId: senderId,
            },
          ],
        },
      });

    if (!friendship) {
      throw new BadRequestException(
        'You can only send messages to your friends',
      );
    }

    // =======================================================
    // Find or create the conversation.
    // =======================================================

    const [user1Id, user2Id] =
      senderId < receiverId
        ? [senderId, receiverId]
        : [receiverId, senderId];

    let conversation =
      await this.prisma.conversation.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id,
            user2Id,
          },
        },
      });

    if (!conversation) {
      conversation =
        await this.prisma.conversation.create({
          data: {
            user1Id,
            user2Id,
          },
        });
    }

    // =======================================================
    // Validate reply-to message.
    // =======================================================

    if (replyToId) {
      const replyToMessage =
        await this.prisma.message.findUnique({
          where: {
            id: replyToId,
          },
          select: {
            id: true,
            conversationId: true,
          },
        });

      if (!replyToMessage) {
        throw new NotFoundException(
          'Message you are replying to was not found',
        );
      }

      if (
        replyToMessage.conversationId !==
        conversation.id
      ) {
        throw new BadRequestException(
          'You can only reply to a message in the same conversation',
        );
      }
    }

    // =======================================================
    // Validate attachments.
    // =======================================================

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (
          !attachment.fileName ||
          !attachment.fileUrl ||
          !attachment.mimeType
        ) {
          throw new BadRequestException(
            'Attachment information is incomplete',
          );
        }

        if (
          !Number.isInteger(attachment.fileSize) ||
          attachment.fileSize < 0
        ) {
          throw new BadRequestException(
            'Attachment file size is invalid',
          );
        }
      }
    }

    // =======================================================
    // Create the message and attachments.
    // =======================================================

    const message =
      await this.prisma.message.create({
        data: {
          conversation: {
            connect: {
              id: conversation.id,
            },
          },

          sender: {
            connect: {
              id: senderId,
            },
          },

          content: trimmedContent,
          isRead: false,

          ...(attachments &&
          attachments.length > 0
            ? {
                attachments: {
                  create: attachments.map(
                    (attachment) => ({
                      fileName:
                        attachment.fileName,
                      fileUrl:
                        attachment.fileUrl,
                      mimeType:
                        attachment.mimeType,
                      fileSize:
                        attachment.fileSize,
                    }),
                  ),
                },
              }
            : {}),

          ...(replyToId
            ? {
                replyTo: {
                  connect: {
                    id: replyToId,
                  },
                },
              }
            : {}),
        },

        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },

          replyTo: {
            select: {
              id: true,
              senderId: true,
              content: true,
              createdAt: true,

              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          attachments: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    // =======================================================
    // Create database notification.
    // =======================================================

    const notification =
      await this.notificationsService.createNotification(
        receiverId,
        'MESSAGE',
        `${sender.displayName || sender.username} sent you a new message`,
      );

    // =======================================================
    // Send notification task to Celery.
    // =======================================================

    await this.celeryService.sendMessageNotification(
      senderId,
      receiverId,
      trimmedContent,
    );

    // =======================================================
    // Update conversation timestamp.
    // =======================================================

    await this.prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return {
      message,
      notification,
    };
  }

  // =========================================================
  // 2. Get or create a conversation with a friend
  // =========================================================

  async getOrCreateConversation(
    userId: string,
    otherUserId: string,
  ) {
    if (userId === otherUserId) {
      throw new BadRequestException(
        'You cannot create a conversation with yourself',
      );
    }

    const otherUser =
      await this.prisma.user.findUnique({
        where: {
          id: otherUserId,
        },
      });

    if (!otherUser) {
      throw new NotFoundException(
        'User not found',
      );
    }

    // =======================================================
    // Check blocks.
    // =======================================================

    const block =
      await this.prisma.blockedUser.findFirst({
        where: {
          OR: [
            {
              blockerId: userId,
              blockedId: otherUserId,
            },
            {
              blockerId: otherUserId,
              blockedId: userId,
            },
          ],
        },
      });

    if (block) {
      throw new BadRequestException(
        'You cannot create a conversation with a blocked user',
      );
    }

    // =======================================================
    // Check friendship.
    // =======================================================

    const friendship =
      await this.prisma.friendRequest.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            {
              senderId: userId,
              receiverId: otherUserId,
            },
            {
              senderId: otherUserId,
              receiverId: userId,
            },
          ],
        },
      });

    if (!friendship) {
      throw new BadRequestException(
        'You can only create conversations with your friends',
      );
    }

    const [user1Id, user2Id] =
      userId < otherUserId
        ? [userId, otherUserId]
        : [otherUserId, userId];

    let conversation =
      await this.prisma.conversation.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id,
            user2Id,
          },
        },
      });

    if (!conversation) {
      conversation =
        await this.prisma.conversation.create({
          data: {
            user1Id,
            user2Id,
          },
        });
    }

    return {
      id: conversation.id,
      user1Id: conversation.user1Id,
      user2Id: conversation.user2Id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  // =========================================================
  // 3. Get messages from one conversation
  //    WITH PAGINATION
  //    Hides messages deleted "for me"
  // =========================================================

  async getConversationMessages(
    userId: string,
    conversationId: string,
    limit = 30,
    before?: string,
  ) {
    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    if (
      conversation.user1Id !== userId &&
      conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    const safeLimit = Math.min(
      Math.max(limit || 30, 1),
      50,
    );

    let beforeMessage:
      | {
          id: string;
          createdAt: Date;
        }
      | null = null;

    if (before) {
      beforeMessage =
        await this.prisma.message.findFirst({
          where: {
            id: before,
            conversationId,
          },
          select: {
            id: true,
            createdAt: true,
          },
        });

      if (!beforeMessage) {
        throw new NotFoundException(
          'Before message not found',
        );
      }
    }

    const messages =
      await this.prisma.message.findMany({
        where: {
          conversationId,

          // =================================================
          // Hide messages deleted for this user.
          // =================================================

          deletions: {
            none: {
              userId,
            },
          },

          ...(beforeMessage
            ? {
                createdAt: {
                  lt: beforeMessage.createdAt,
                },
              }
            : {}),
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: safeLimit + 1,

        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },

          replyTo: {
            select: {
              id: true,
              senderId: true,
              content: true,
              createdAt: true,

              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          reactions: {
            orderBy: {
              createdAt: 'asc',
            },

            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          attachments: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    const hasMore =
      messages.length > safeLimit;

    const pageMessages = hasMore
      ? messages.slice(0, safeLimit)
      : messages;

    pageMessages.reverse();

    const nextCursor =
      hasMore &&
      pageMessages.length > 0
        ? pageMessages[0].id
        : null;

    return {
      conversationId,
      messages: pageMessages,
      hasMore,
      nextCursor,
    };
  }

  // =========================================================
  // 4. Search messages in a conversation
  //    Hides messages deleted "for me"
  // =========================================================

  async searchMessages(
    userId: string,
    conversationId: string,
    query: string,
  ) {
    const trimmedQuery = query?.trim() ?? '';

    if (!trimmedQuery) {
      throw new BadRequestException(
        'Search query cannot be empty',
      );
    }

    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    if (
      conversation.user1Id !== userId &&
      conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    const messages =
      await this.prisma.message.findMany({
        where: {
          conversationId,

          // =================================================
          // Hide messages deleted for this user.
          // =================================================

          deletions: {
            none: {
              userId,
            },
          },

          content: {
            contains: trimmedQuery,
            mode: 'insensitive',
          },
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 50,

        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },

          replyTo: {
            select: {
              id: true,
              senderId: true,
              content: true,
              createdAt: true,

              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          reactions: {
            orderBy: {
              createdAt: 'asc',
            },

            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          attachments: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    return {
      conversationId,
      query: trimmedQuery,
      count: messages.length,
      messages,
    };
  }

  // =========================================================
  // 5. Mark messages as read
  // =========================================================

  async markConversationAsRead(
    userId: string,
    conversationId: string,
  ) {
    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    if (
      conversation.user1Id !== userId &&
      conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    const result =
      await this.prisma.message.updateMany({
        where: {
          conversationId,
          senderId: {
            not: userId,
          },
          isRead: false,
        },

        data: {
          isRead: true,
        },
      });

    return {
      message: 'Messages marked as read',
      count: result.count,
    };
  }

  // =========================================================
  // 6. Get all conversations
  //    Hides messages deleted "for me"
  // =========================================================

  async getConversations(userId: string) {
    const conversations =
      await this.prisma.conversation.findMany({
        where: {
          OR: [
            {
              user1Id: userId,
            },
            {
              user2Id: userId,
            },
          ],
        },

        orderBy: {
          updatedAt: 'desc',
        },

        include: {
          user1: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },

          user2: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },

          messages: {
            where: {
              // =================================================
              // Do not show a message deleted for this user
              // as the conversation's last message.
              // =================================================

              deletions: {
                none: {
                  userId,
                },
              },
            },

            orderBy: {
              createdAt: 'desc',
            },

            take: 1,

            include: {
              replyTo: {
                select: {
                  id: true,
                  senderId: true,
                  content: true,
                  createdAt: true,

                  sender: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },

              reactions: {
                orderBy: {
                  createdAt: 'asc',
                },

                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },

              attachments: {
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          },
        },
      });

    return conversations.map(
      (conversation) => {
        const otherUser =
          conversation.user1Id === userId
            ? conversation.user2
            : conversation.user1;

        return {
          id: conversation.id,
          otherUser,

          lastMessage:
            conversation.messages.length > 0
              ? conversation.messages[0]
              : null,

          createdAt:
            conversation.createdAt,

          updatedAt:
            conversation.updatedAt,
        };
      },
    );
  }

  // =========================================================
  // 7. Delete a conversation
  // =========================================================

  async deleteConversation(
    userId: string,
    conversationId: string,
  ) {
    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    if (
      conversation.user1Id !== userId &&
      conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    await this.prisma.message.deleteMany({
      where: {
        conversationId,
      },
    });

    await this.prisma.conversation.delete({
      where: {
        id: conversationId,
      },
    });

    return {
      message: 'Conversation deleted successfully',
    };
  }

  // =========================================================
  // 8. Edit a message
  // =========================================================

  async editMessage(
    userId: string,
    messageId: string,
    content: string,
  ) {
    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        include: {
          conversation: true,
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    if (message.senderId !== userId) {
      throw new BadRequestException(
        'You can only edit your own messages',
      );
    }

    if (!message.conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    const trimmedContent =
      content.trim();

    if (!trimmedContent) {
      throw new BadRequestException(
        'Message content cannot be empty',
      );
    }

    const updatedMessage =
      await this.prisma.message.update({
        where: {
          id: messageId,
        },

        data: {
          content: trimmedContent,
        },

        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },

          replyTo: {
            select: {
              id: true,
              senderId: true,
              content: true,
              createdAt: true,

              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          reactions: {
            orderBy: {
              createdAt: 'asc',
            },

            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          attachments: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    return updatedMessage;
  }

  // =========================================================
  // 9. Delete a message
  //
  // Backward-compatible method.
  //
  // This now means:
  // DELETE FOR EVERYONE
  // =========================================================

  async deleteMessage(
    userId: string,
    messageId: string,
  ) {
    return this.deleteMessageForEveryone(
      userId,
      messageId,
    );
  }

  // =========================================================
  // 9A. Delete message FOR ME
  //
  // The message remains in the database.
  // Only this user stops seeing it.
  // =========================================================

  async deleteMessageForMe(
    userId: string,
    messageId: string,
  ) {
    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        select: {
          id: true,
          conversationId: true,

          conversation: {
            select: {
              user1Id: true,
              user2Id: true,
            },
          },
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    // =======================================================
    // Check conversation membership.
    // =======================================================

    if (
      message.conversation.user1Id !== userId &&
      message.conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    // =======================================================
    // Check whether already deleted for this user.
    // =======================================================

    const existingDeletion =
      await this.prisma.messageDeletion.findUnique({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
      });

    // Idempotent behavior:
    // if already deleted, simply return success.
    if (existingDeletion) {
      return {
        message:
          'Message already deleted for you',
        messageId,
        conversationId:
          message.conversationId,
      };
    }

    // =======================================================
    // Create personal deletion record.
    // =======================================================

    await this.prisma.messageDeletion.create({
      data: {
        messageId,
        userId,
      },
    });

    return {
      message:
        'Message deleted for you',
      messageId,
      conversationId:
        message.conversationId,
    };
  }

  // =========================================================
  // 9B. Delete message FOR EVERYONE
  //
  // Permanently removes the message.
  // Only the original sender can do this.
  // =========================================================

  async deleteMessageForEveryone(
    userId: string,
    messageId: string,
  ) {
    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        select: {
          id: true,
          senderId: true,
          conversationId: true,

          conversation: {
            select: {
              user1Id: true,
              user2Id: true,
            },
          },
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    // =======================================================
    // Check conversation membership.
    // =======================================================

    if (
      message.conversation.user1Id !== userId &&
      message.conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    // =======================================================
    // Only sender can delete for everyone.
    // =======================================================

    if (message.senderId !== userId) {
      throw new BadRequestException(
        'You can only delete your own messages for everyone',
      );
    }

    // =======================================================
    // Permanently delete message.
    //
    // Cascades:
    // - attachments
    // - reactions
    // - personal deletion records
    //
    // Reply references use SetNull.
    // =======================================================

    await this.prisma.message.delete({
      where: {
        id: messageId,
      },
    });

    return {
      message:
        'Message deleted for everyone',
      messageId,
      conversationId:
        message.conversationId,
    };
  }

  // =========================================================
  // 10. Add or change a message reaction
  // =========================================================

  async reactToMessage(
    userId: string,
    messageId: string,
    emoji: string,
  ) {
    const trimmedEmoji = emoji.trim();

    if (!trimmedEmoji) {
      throw new BadRequestException(
        'Reaction emoji cannot be empty',
      );
    }

    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        select: {
          id: true,
          conversationId: true,

          conversation: {
            select: {
              user1Id: true,
              user2Id: true,
            },
          },
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    if (
      message.conversation.user1Id !== userId &&
      message.conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    const existingReaction =
      await this.prisma.messageReaction.findUnique({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
      });

    let reaction;

    if (existingReaction) {
      reaction =
        await this.prisma.messageReaction.update({
          where: {
            id: existingReaction.id,
          },

          data: {
            emoji: trimmedEmoji,
          },

          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        });
    } else {
      reaction =
        await this.prisma.messageReaction.create({
          data: {
            messageId,
            userId,
            emoji: trimmedEmoji,
          },

          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        });
    }

    return reaction;
  }

  // =========================================================
  // 11. Remove your reaction from a message
  // =========================================================

  async removeReaction(
    userId: string,
    messageId: string,
  ) {
    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        select: {
          id: true,

          conversation: {
            select: {
              user1Id: true,
              user2Id: true,
            },
          },
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    if (
      message.conversation.user1Id !== userId &&
      message.conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    const existingReaction =
      await this.prisma.messageReaction.findUnique({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
      });

    if (!existingReaction) {
      throw new NotFoundException(
        'Reaction not found',
      );
    }

    await this.prisma.messageReaction.delete({
      where: {
        id: existingReaction.id,
      },
    });

    return {
      message:
        'Reaction removed successfully',
      messageId,
    };
  }

  // =========================================================
  // 12. Get reactions for a message
  // =========================================================

  async getMessageReactions(
    userId: string,
    messageId: string,
  ) {
    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        select: {
          id: true,

          conversation: {
            select: {
              user1Id: true,
              user2Id: true,
            },
          },
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    if (
      message.conversation.user1Id !== userId &&
      message.conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    return this.prisma.messageReaction.findMany({
      where: {
        messageId,
      },

      orderBy: {
        createdAt: 'asc',
      },

      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // =========================================================
  // 13. Pin a message
  // =========================================================

  async pinMessage(
    userId: string,
    messageId: string,
  ) {
    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        select: {
          id: true,
          conversationId: true,
          isPinned: true,

          conversation: {
            select: {
              user1Id: true,
              user2Id: true,
            },
          },
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    if (
      message.conversation.user1Id !== userId &&
      message.conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    if (message.isPinned) {
      return this.getMessageWithDetails(
        messageId,
      );
    }

    await this.prisma.message.update({
      where: {
        id: messageId,
      },

      data: {
        isPinned: true,
      },
    });

    return this.getMessageWithDetails(
      messageId,
    );
  }

  // =========================================================
  // 14. Unpin a message
  // =========================================================

  async unpinMessage(
    userId: string,
    messageId: string,
  ) {
    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        select: {
          id: true,
          conversationId: true,
          isPinned: true,

          conversation: {
            select: {
              user1Id: true,
              user2Id: true,
            },
          },
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    if (
      message.conversation.user1Id !== userId &&
      message.conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    if (!message.isPinned) {
      return this.getMessageWithDetails(
        messageId,
      );
    }

    await this.prisma.message.update({
      where: {
        id: messageId,
      },

      data: {
        isPinned: false,
      },
    });

    return this.getMessageWithDetails(
      messageId,
    );
  }

  // =========================================================
  // 15. Get one message with all message details
  // =========================================================

  private async getMessageWithDetails(
    messageId: string,
  ) {
    return this.prisma.message.findUnique({
      where: {
        id: messageId,
      },

      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },

        replyTo: {
          select: {
            id: true,
            senderId: true,
            content: true,
            createdAt: true,

            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },

        reactions: {
          orderBy: {
            createdAt: 'asc',
          },

          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },

        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  // =========================================================
  // 16. Get all pinned messages in a conversation
  //     Hides messages deleted "for me"
  // =========================================================

  async getPinnedMessages(
    userId: string,
    conversationId: string,
  ) {
    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    if (
      conversation.user1Id !== userId &&
      conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    return this.prisma.message.findMany({
      where: {
        conversationId,
        isPinned: true,

        // =================================================
        // Hide messages deleted for this user.
        // =================================================

        deletions: {
          none: {
            userId,
          },
        },
      },

      orderBy: {
        createdAt: 'asc',
      },

      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },

        replyTo: {
          select: {
            id: true,
            senderId: true,
            content: true,
            createdAt: true,

            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },

        reactions: {
          orderBy: {
            createdAt: 'asc',
          },

          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },

        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  // =========================================================
  // 17. Forward a message to another friend
  // =========================================================

  async forwardMessage(
    userId: string,
    messageId: string,
    receiverId: string,
  ) {
    // =======================================================
    // Basic validation
    // =======================================================

    if (userId === receiverId) {
      throw new BadRequestException(
        'You cannot forward a message to yourself',
      );
    }

    // =======================================================
    // Find the original message
    // =======================================================

    const originalMessage =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        include: {
          conversation: true,

          attachments: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    if (!originalMessage) {
      throw new NotFoundException(
        'Message to forward was not found',
      );
    }

    // =======================================================
    // Check original conversation membership
    // =======================================================

    if (
      originalMessage.conversation.user1Id !== userId &&
      originalMessage.conversation.user2Id !== userId
    ) {
      throw new BadRequestException(
        'You are not a member of the original conversation',
      );
    }

    // =======================================================
    // Check receiver exists
    // =======================================================

    const receiver =
      await this.prisma.user.findUnique({
        where: {
          id: receiverId,
        },
      });

    if (!receiver) {
      throw new NotFoundException(
        'Receiver not found',
      );
    }

    // =======================================================
    // Check blocks
    // =======================================================

    const block =
      await this.prisma.blockedUser.findFirst({
        where: {
          OR: [
            {
              blockerId: userId,
              blockedId: receiverId,
            },
            {
              blockerId: receiverId,
              blockedId: userId,
            },
          ],
        },
      });

    if (block) {
      throw new BadRequestException(
        'You cannot forward messages to a blocked user',
      );
    }

    // =======================================================
    // Check friendship
    // =======================================================

    const friendship =
      await this.prisma.friendRequest.findFirst({
        where: {
          status: 'ACCEPTED',

          OR: [
            {
              senderId: userId,
              receiverId,
            },
            {
              senderId: receiverId,
              receiverId: userId,
            },
          ],
        },
      });

    if (!friendship) {
      throw new BadRequestException(
        'You can only forward messages to your friends',
      );
    }

    // =======================================================
    // Find or create target conversation
    // =======================================================

    const [user1Id, user2Id] =
      userId < receiverId
        ? [userId, receiverId]
        : [receiverId, userId];

    let conversation =
      await this.prisma.conversation.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id,
            user2Id,
          },
        },
      });

    if (!conversation) {
      conversation =
        await this.prisma.conversation.create({
          data: {
            user1Id,
            user2Id,
          },
        });
    }

    // =======================================================
    // Create a NEW message.
    // =======================================================

    const forwardedMessage =
      await this.prisma.message.create({
        data: {
          conversation: {
            connect: {
              id: conversation.id,
            },
          },

          sender: {
            connect: {
              id: userId,
            },
          },

          content: originalMessage.content,

          isRead: false,

          // =================================================
          // Copy attachments
          // =================================================

          ...(originalMessage.attachments.length > 0
            ? {
                attachments: {
                  create:
                    originalMessage.attachments.map(
                      (attachment) => ({
                        fileName:
                          attachment.fileName,

                        fileUrl:
                          attachment.fileUrl,

                        mimeType:
                          attachment.mimeType,

                        fileSize:
                          attachment.fileSize,
                      }),
                    ),
                },
              }
            : {}),
        },

        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },

          replyTo: {
            select: {
              id: true,
              senderId: true,
              content: true,
              createdAt: true,

              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          reactions: {
            orderBy: {
              createdAt: 'asc',
            },

            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          attachments: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    // =======================================================
    // Find sender information
    // =======================================================

    const sender =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          username: true,
          displayName: true,
        },
      });

    // =======================================================
    // Create notification
    // =======================================================

    const notification =
      await this.notificationsService.createNotification(
        receiverId,
        'MESSAGE',
        `${sender?.displayName || sender?.username || 'Someone'} forwarded you a message`,
      );

    // =======================================================
    // Send notification task to Celery
    // =======================================================

    await this.celeryService.sendMessageNotification(
      userId,
      receiverId,
      originalMessage.content,
    );

    // =======================================================
    // Update target conversation timestamp
    // =======================================================

    await this.prisma.conversation.update({
      where: {
        id: conversation.id,
      },

      data: {
        updatedAt: new Date(),
      },
    });

    // =======================================================
    // Return forwarded message and notification
    // =======================================================

    return {
      message: forwardedMessage,
      notification,
    };
  }
}
