import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

import { MessagesService } from './messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}

interface MessageAttachmentInput {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway {
  @WebSocketServer()
  server: Server;

  /*
   * userId -> number of active socket connections
   */
  private onlineUsers = new Map<string, number>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // =========================================================
  // USER CONNECTED
  // =========================================================

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace(
          'Bearer ',
          '',
        );

      if (!token) {
        console.log(
          `WebSocket rejected: No token (${client.id})`,
        );

        client.disconnect(true);
        return;
      }

      const secret =
        this.configService.getOrThrow<string>(
          'JWT_SECRET',
        );

      const payload = jwt.verify(
        token,
        secret,
      ) as JwtPayload;

      if (!payload.sub) {
        console.log(
          `WebSocket rejected: Invalid token (${client.id})`,
        );

        client.disconnect(true);
        return;
      }

      // Store authenticated user on socket
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        username: payload.username,
      };

      // Join personal user room
      client.join(`user:${payload.sub}`);

      const currentConnections =
        this.onlineUsers.get(payload.sub) ?? 0;

      const newConnectionCount =
        currentConnections + 1;

      this.onlineUsers.set(
        payload.sub,
        newConnectionCount,
      );

      console.log(
        `WebSocket authenticated: ${payload.username}`,
      );

      console.log(
        `User ${payload.sub} connections: ${newConnectionCount}`,
      );

      console.log(
        `User ${payload.sub} joined personal room: user:${payload.sub}`,
      );

      // Send current online users to this client
      client.emit('onlineUsers', {
        userIds: Array.from(
          this.onlineUsers.keys(),
        ),
      });

      // Only broadcast when first connection
      if (currentConnections === 0) {
        client.broadcast.emit('userOnline', {
          userId: payload.sub,
        });

        console.log(
          `User ${payload.sub} is now ONLINE`,
        );
      }
    } catch (error) {
      console.log(
        `WebSocket authentication failed (${client.id})`,
      );

      client.disconnect(true);
    }
  }

  // =========================================================
  // USER DISCONNECTED
  // =========================================================

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId;

    if (!userId) {
      console.log(
        `Unauthenticated socket disconnected: ${client.id}`,
      );

      return;
    }

    const currentConnections =
      this.onlineUsers.get(userId) ?? 0;

    console.log(
      `Socket disconnected for user ${userId}`,
    );

    console.log(
      `Current connections before removal: ${currentConnections}`,
    );

    // No connection left
    if (currentConnections <= 1) {
      this.onlineUsers.delete(userId);

      console.log(
        `User ${userId} is now OFFLINE`,
      );

      this.server.emit('userOffline', {
        userId,
      });

      return;
    }

    // Other tabs/devices are still connected
    const remainingConnections =
      currentConnections - 1;

    this.onlineUsers.set(
      userId,
      remainingConnections,
    );

    console.log(
      `User ${userId} disconnected one socket.`,
    );

    console.log(
      `Remaining connections: ${remainingConnections}`,
    );
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  @SubscribeMessage('logout')
  handleLogout(
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;

    if (!userId) {
      console.log(
        `Logout requested by unauthenticated socket: ${client.id}`,
      );

      client.disconnect(true);

      return {
        message: 'Logged out',
      };
    }

    console.log(
      `Logout requested by user ${userId}`,
    );

    /*
     * Do not modify onlineUsers here.
     * handleDisconnect() owns presence state.
     */
    client.disconnect(true);

    return {
      message: 'Logged out successfully',
    };
  }

  // =========================================================
  // JOIN CONVERSATION
  // =========================================================

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @MessageBody()
    data: {
      conversationId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: data.conversationId,
        },
      });

    if (!conversation) {
      return {
        error: 'Conversation not found',
      };
    }

    const isMember =
      conversation.user1Id === userId ||
      conversation.user2Id === userId;

    if (!isMember) {
      console.log(
        `User ${userId} attempted to join unauthorized conversation ${data.conversationId}`,
      );

      return {
        error:
          'You are not a member of this conversation',
      };
    }

    const room =
      `conversation:${data.conversationId}`;

    client.join(room);

    console.log(
      `User ${userId} joined conversation ${data.conversationId}`,
    );

    return {
      message: 'Joined conversation successfully',
      conversationId: data.conversationId,
    };
  }

  // =========================================================
  // TYPING INDICATOR
  // =========================================================

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody()
    data: {
      conversationId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: data.conversationId,
        },
      });

    if (!conversation) {
      return {
        error: 'Conversation not found',
      };
    }

    const isMember =
      conversation.user1Id === userId ||
      conversation.user2Id === userId;

    if (!isMember) {
      return {
        error:
          'You are not a member of this conversation',
      };
    }

    const otherUserId =
      conversation.user1Id === userId
        ? conversation.user2Id
        : conversation.user1Id;

    console.log(
      `User ${userId} is typing in conversation ${data.conversationId}`,
    );

    this.server
      .to(`user:${otherUserId}`)
      .emit('userTyping', {
        conversationId:
          data.conversationId,
        userId,
      });

    return {
      message: 'Typing event sent',
    };
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @MessageBody()
    data: {
      conversationId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: data.conversationId,
        },
      });

    if (!conversation) {
      return {
        error: 'Conversation not found',
      };
    }

    const isMember =
      conversation.user1Id === userId ||
      conversation.user2Id === userId;

    if (!isMember) {
      return {
        error:
          'You are not a member of this conversation',
      };
    }

    const otherUserId =
      conversation.user1Id === userId
        ? conversation.user2Id
        : conversation.user1Id;

    console.log(
      `User ${userId} stopped typing in conversation ${data.conversationId}`,
    );

    this.server
      .to(`user:${otherUserId}`)
      .emit('userStoppedTyping', {
        conversationId:
          data.conversationId,
        userId,
      });

    return {
      message: 'Stop typing event sent',
    };
  }

  // =========================================================
  // MARK CONVERSATION AS READ
  // =========================================================

  @SubscribeMessage('markConversationAsRead')
  async handleMarkConversationAsRead(
    @MessageBody()
    data: {
      conversationId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    console.log(
      `User ${userId} marked conversation ${data.conversationId} as read`,
    );

    const result =
      await this.messagesService.markConversationAsRead(
        userId,
        data.conversationId,
      );

    /*
     * Tell the OTHER participant that their messages
     * have been read.
     */
    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: data.conversationId,
        },
      });

    if (!conversation) {
      return result;
    }

    const otherUserId =
      conversation.user1Id === userId
        ? conversation.user2Id
        : conversation.user1Id;

    /*
     * Send read receipt directly to the other user's
     * personal socket room.
     */
    this.server
      .to(`user:${otherUserId}`)
      .emit('messagesRead', {
        conversationId:
          data.conversationId,
        readBy: userId,
      });

    console.log(
      `Read receipt sent to user ${otherUserId}`,
    );

    return result;
  }

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: {
      receiverId: string;
      content: string;
      replyToId?: string;

      // Optional attachments
      attachments?: MessageAttachmentInput[];
    },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId =
      client.data.user?.userId;

    if (!senderId) {
      client.disconnect(true);
      return;
    }

    console.log('Sending message:', {
      senderId,
      receiverId: data.receiverId,
      content: data.content,
      replyToId: data.replyToId,
      attachments: data.attachments,
    });

    /*
     * MessagesService returns BOTH:
     *
     * 1. The newly created message
     * 2. The real database notification
     *
     * Attachments are passed as the fifth argument.
     */
    const result =
      await this.messagesService.sendMessage(
        senderId,
        data.receiverId,
        data.content,
        data.replyToId,
        data.attachments,
      );

    const message = result.message;
    const notification =
      result.notification;

    // =======================================================
    // SEND MESSAGE TO CONVERSATION ROOM
    // =======================================================

    const room =
      `conversation:${message.conversationId}`;

    console.log(
      'Sending message to room:',
      room,
    );

    this.server
      .to(room)
      .emit('newMessage', message);

    // =======================================================
    // SEND REAL-TIME NOTIFICATION TO RECEIVER
    // =======================================================

    const receiverRoom =
      `user:${data.receiverId}`;

    console.log(
      'Sending real-time notification to:',
      receiverRoom,
    );

    this.server
      .to(receiverRoom)
      .emit(
        'newNotification',
        notification,
      );

    console.log(
      `Real-time notification sent to user ${data.receiverId}`,
    );

    // =======================================================
    // RETURN SUCCESS
    // =======================================================

    return {
      message: 'Message sent successfully',
      data: message,
    };
  }

  // =========================================================
  // EDIT MESSAGE
  // =========================================================

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody()
    data: {
      messageId: string;
      content: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId =
      client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    console.log('Editing message:', {
      userId,
      messageId: data.messageId,
      content: data.content,
    });

    try {
      const updatedMessage =
        await this.messagesService.editMessage(
          userId,
          data.messageId,
          data.content,
        );

      const message =
        await this.prisma.message.findUnique({
          where: {
            id: data.messageId,
          },
          select: {
            conversationId: true,
          },
        });

      if (!message) {
        return {
          error: 'Message not found',
        };
      }

      const room =
        `conversation:${message.conversationId}`;

      this.server
        .to(room)
        .emit(
          'messageEdited',
          updatedMessage,
        );

      console.log(
        `Message ${data.messageId} edited successfully`,
      );

      return {
        message:
          'Message edited successfully',
        data: updatedMessage,
      };
    } catch (error) {
      console.error(
        'Failed to edit message:',
        error,
      );

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Could not edit message',
      };
    }
  }

  // =========================================================
  // DELETE MESSAGE
  // =========================================================

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody()
    data: {
      messageId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId =
      client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    console.log('Deleting message:', {
      userId,
      messageId: data.messageId,
    });

    try {
      const result =
        await this.messagesService.deleteMessage(
          userId,
          data.messageId,
        );

      const room =
        `conversation:${result.conversationId}`;

      this.server
        .to(room)
        .emit('messageDeleted', {
          messageId: result.messageId,
          conversationId:
            result.conversationId,
        });

      console.log(
        `Message ${result.messageId} deleted successfully`,
      );

      return {
        message:
          'Message deleted successfully',
        data: result,
      };
    } catch (error) {
      console.error(
        'Failed to delete message:',
        error,
      );

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Could not delete message',
      };
    }
  }

  // =========================================================
  // MESSAGE REACTION
  // =========================================================

  @SubscribeMessage('reactToMessage')
  async handleReactToMessage(
    @MessageBody()
    data: {
      messageId: string;
      emoji: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId =
      client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    console.log('Reacting to message:', {
      userId,
      messageId: data.messageId,
      emoji: data.emoji,
    });

    try {
      const reaction =
        await this.messagesService.reactToMessage(
          userId,
          data.messageId,
          data.emoji,
        );

      /*
       * Find the conversation so we know which
       * Socket.IO room should receive the update.
       */
      const message =
        await this.prisma.message.findUnique({
          where: {
            id: data.messageId,
          },
          select: {
            conversationId: true,
          },
        });

      if (!message) {
        return {
          error: 'Message not found',
        };
      }

      const room =
        `conversation:${message.conversationId}`;

      /*
       * Send the updated reaction to everyone
       * inside the conversation.
       */
      this.server
        .to(room)
        .emit('messageReactionUpdated', {
          action: 'added',
          reaction,
        });

      console.log(
        `Reaction ${data.emoji} added to message ${data.messageId}`,
      );

      return {
        message:
          'Message reaction added successfully',
        data: reaction,
      };
    } catch (error) {
      console.error(
        'Failed to react to message:',
        error,
      );

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Could not react to message',
      };
    }
  }

  // =========================================================
  // REMOVE MESSAGE REACTION
  // =========================================================

  @SubscribeMessage('removeReaction')
  async handleRemoveReaction(
    @MessageBody()
    data: {
      messageId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId =
      client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    console.log('Removing reaction:', {
      userId,
      messageId: data.messageId,
    });

    try {
      const result =
        await this.messagesService.removeReaction(
          userId,
          data.messageId,
        );

      /*
       * Find the conversation so we know which
       * Socket.IO room should receive the update.
       */
      const message =
        await this.prisma.message.findUnique({
          where: {
            id: data.messageId,
          },
          select: {
            conversationId: true,
          },
        });

      if (!message) {
        return {
          error: 'Message not found',
        };
      }

      const room =
        `conversation:${message.conversationId}`;

      /*
       * Tell everyone in the conversation that
       * this user's reaction was removed.
       */
      this.server
        .to(room)
        .emit('messageReactionUpdated', {
          action: 'removed',
          reaction: {
            messageId: data.messageId,
            userId,
          },
        });

      console.log(
        `Reaction removed from message ${data.messageId}`,
      );

      return {
        message:
          'Message reaction removed successfully',
        data: result,
      };
    } catch (error) {
      console.error(
        'Failed to remove reaction:',
        error,
      );

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Could not remove reaction',
      };
    }
  }

  // =========================================================
  // PIN MESSAGE
  // =========================================================

  @SubscribeMessage('pinMessage')
  async handlePinMessage(
    @MessageBody()
    data: {
      messageId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId =
      client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    console.log('Pinning message:', {
      userId,
      messageId: data.messageId,
    });

    try {
      const pinnedMessage =
        await this.messagesService.pinMessage(
          userId,
          data.messageId,
        );

      const message =
        await this.prisma.message.findUnique({
          where: {
            id: data.messageId,
          },
          select: {
            conversationId: true,
          },
        });

      if (!message) {
        return {
          error: 'Message not found',
        };
      }

      const room =
        `conversation:${message.conversationId}`;

      /*
       * Notify everyone currently inside
       * this conversation.
       */
      this.server
        .to(room)
        .emit(
          'messagePinned',
          pinnedMessage,
        );

      console.log(
        `Message ${data.messageId} pinned in conversation ${message.conversationId}`,
      );

      return {
        message:
          'Message pinned successfully',
        data: pinnedMessage,
      };
    } catch (error) {
      console.error(
        'Failed to pin message:',
        error,
      );

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Could not pin message',
      };
    }
  }

  // =========================================================
  // UNPIN MESSAGE
  // =========================================================

  @SubscribeMessage('unpinMessage')
  async handleUnpinMessage(
    @MessageBody()
    data: {
      messageId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId =
      client.data.user?.userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    console.log('Unpinning message:', {
      userId,
      messageId: data.messageId,
    });

    try {
      const unpinnedMessage =
        await this.messagesService.unpinMessage(
          userId,
          data.messageId,
        );

      const message =
        await this.prisma.message.findUnique({
          where: {
            id: data.messageId,
          },
          select: {
            conversationId: true,
          },
        });

      if (!message) {
        return {
          error: 'Message not found',
        };
      }

      const room =
        `conversation:${message.conversationId}`;

      /*
       * Notify everyone currently inside
       * this conversation.
       */
      this.server
        .to(room)
        .emit(
          'messageUnpinned',
          unpinnedMessage,
        );

      console.log(
        `Message ${data.messageId} unpinned in conversation ${message.conversationId}`,
      );

      return {
        message:
          'Message unpinned successfully',
        data: unpinnedMessage,
      };
    } catch (error) {
      console.error(
        'Failed to unpin message:',
        error,
      );

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Could not unpin message',
      };
    }
  }
}
