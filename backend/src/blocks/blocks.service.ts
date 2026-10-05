import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async blockUser(
    blockerId: string,
    blockedId: string,
  ) {
    if (blockerId === blockedId) {
      throw new ConflictException(
        'You cannot block yourself',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: blockedId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const existingBlock =
      await this.prisma.blockedUser.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      });

    if (existingBlock) {
      throw new ConflictException(
        'User is already blocked',
      );
    }

    return this.prisma.blockedUser.create({
      data: {
        blockerId,
        blockedId,
      },
    });
  }

  async unblockUser(
    blockerId: string,
    blockedId: string,
  ) {
    const existingBlock =
      await this.prisma.blockedUser.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      });

    if (!existingBlock) {
      throw new NotFoundException(
        'User is not blocked',
      );
    }

    await this.prisma.blockedUser.delete({
      where: {
        id: existingBlock.id,
      },
    });

    return {
      message: 'User unblocked successfully',
    };
  }

  async getBlockedUsers(blockerId: string) {
    return this.prisma.blockedUser.findMany({
      where: {
        blockerId,
      },
      include: {
        blocked: {
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

  async isBlocked(
    blockerId: string,
    blockedId: string,
  ) {
    const block =
      await this.prisma.blockedUser.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
      });

    return {
      blocked: !!block,
    };
  }
}
