import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FriendsService } from './friends.service.js';
import { SendFriendRequestDto } from './dto/send-friend-request.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface JwtRequest extends Request {
  user: {
    userId: string;
    email: string;
    username: string;
  };
}

@Controller('friends')
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
  ) {}

  // 1. Send friend request
  @UseGuards(JwtAuthGuard)
  @Post('request')
  sendFriendRequest(
    @Req() request: JwtRequest,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendsService.sendFriendRequest(
      request.user.userId,
      dto.receiverId,
    );
  }

  // 2. Get received pending friend requests
  @UseGuards(JwtAuthGuard)
  @Get('requests')
  getReceivedRequests(@Req() request: JwtRequest) {
    return this.friendsService.getReceivedRequests(
      request.user.userId,
    );
  }

  // 3. Get all accepted friends
  @UseGuards(JwtAuthGuard)
  @Get()
  getFriends(@Req() request: JwtRequest) {
    return this.friendsService.getFriends(
      request.user.userId,
    );
  }

  // 4. Accept friend request
  @UseGuards(JwtAuthGuard)
  @Post('requests/:id/accept')
  acceptFriendRequest(
    @Req() request: JwtRequest,
    @Param('id') requestId: string,
  ) {
    return this.friendsService.acceptFriendRequest(
      request.user.userId,
      requestId,
    );
  }

  // 5. Reject friend request
  @UseGuards(JwtAuthGuard)
  @Post('requests/:id/reject')
  rejectFriendRequest(
    @Req() request: JwtRequest,
    @Param('id') requestId: string,
  ) {
    return this.friendsService.rejectFriendRequest(
      request.user.userId,
      requestId,
    );
  }
}

