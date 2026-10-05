import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async searchUsers(
    username: string,
    currentUserId: string,
  ) {
    const users =
      await this.prisma.user.findMany({
        where: {
          username: {
            contains: username,
            mode: 'insensitive',
          },
          NOT: {
            id: currentUserId,
          },
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
        },
        take: 20,
        orderBy: {
          username: 'asc',
        },
      });

    return users;
  }

  async getProfile(userId: string) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    return user;
  }

  async updateProfile(
    userId: string,
    displayName?: string,
    avatarUrl?: string | null,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const updatedUser =
      await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          ...(displayName !== undefined && {
            displayName,
          }),
          ...(avatarUrl !== undefined && {
            avatarUrl,
          }),
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return {
      message: 'Profile updated successfully',
      user: updatedUser,
    };
  }
}
