import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Send a friend request
  async sendFriendRequest(
    senderId: string,
    receiverId: string,
  ) {
    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself',
      );
    }

    const receiver = await this.prisma.user.findUnique({
      where: {
        id: receiverId,
      },
    });

    if (!receiver) {
      throw new NotFoundException('User not found');
    }

    const existingRequest =
      await this.prisma.friendRequest.findUnique({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId,
          },
        },
      });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new BadRequestException(
          'Friend request already exists',
        );
      }

      if (existingRequest.status === 'ACCEPTED') {
        throw new BadRequestException(
          'You are already friends with this user',
        );
      }

      if (existingRequest.status === 'REJECTED') {
        const updatedRequest =
          await this.prisma.friendRequest.update({
            where: {
              id: existingRequest.id,
            },
            data: {
              status: 'PENDING',
            },
          });

        return {
          message: 'Friend request sent successfully',
          friendRequest: updatedRequest,
        };
      }
    }

    const reverseRequest =
      await this.prisma.friendRequest.findUnique({
        where: {
          senderId_receiverId: {
            senderId: receiverId,
            receiverId: senderId,
          },
        },
      });

    if (reverseRequest) {
      if (reverseRequest.status === 'PENDING') {
        throw new BadRequestException(
          'This user has already sent you a friend request',
        );
      }

      if (reverseRequest.status === 'ACCEPTED') {
        throw new BadRequestException(
          'You are already friends with this user',
        );
      }
    }

    const friendRequest =
      await this.prisma.friendRequest.create({
        data: {
          senderId,
          receiverId,
          status: 'PENDING',
        },
      });

    return {
      message: 'Friend request sent successfully',
      friendRequest,
    };
  }

  // 2. Get received pending friend requests
  async getReceivedRequests(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // 3. Get all accepted friends
  async getFriends(userId: string) {
    const requests =
      await this.prisma.friendRequest.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            {
              senderId: userId,
            },
            {
              receiverId: userId,
            },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          receiver: {
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    return requests.map((request) => {
      return request.senderId === userId
        ? request.receiver
        : request.sender;
    });
  }

  // 4. Accept a friend request
  async acceptFriendRequest(
    userId: string,
    requestId: string,
  ) {
    const friendRequest =
      await this.prisma.friendRequest.findUnique({
        where: {
          id: requestId,
        },
      });

    if (!friendRequest) {
      throw new NotFoundException(
        'Friend request not found',
      );
    }

    if (friendRequest.receiverId !== userId) {
      throw new BadRequestException(
        'You can only accept requests sent to you',
      );
    }

    if (friendRequest.status !== 'PENDING') {
      throw new BadRequestException(
        'Friend request is no longer pending',
      );
    }

    const updatedRequest =
      await this.prisma.friendRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: 'ACCEPTED',
        },
      });

    return {
      message: 'Friend request accepted',
      friendRequest: updatedRequest,
    };
  }

  // 5. Reject a friend request
  async rejectFriendRequest(
    userId: string,
    requestId: string,
  ) {
    const friendRequest =
      await this.prisma.friendRequest.findUnique({
        where: {
          id: requestId,
        },
      });

    if (!friendRequest) {
      throw new NotFoundException(
        'Friend request not found',
      );
    }

    if (friendRequest.receiverId !== userId) {
      throw new BadRequestException(
        'You can only reject requests sent to you',
      );
    }

    if (friendRequest.status !== 'PENDING') {
      throw new BadRequestException(
        'Friend request is no longer pending',
      );
    }

    const updatedRequest =
      await this.prisma.friendRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: 'REJECTED',
        },
      });

    return {
      message: 'Friend request rejected',
      friendRequest: updatedRequest,
    };
  }
}

