import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { BlocksService } from './blocks.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface JwtRequest extends Request {
  user: {
    userId: string;
    email: string;
    username: string;
  };
}

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(
    private readonly blocksService: BlocksService,
  ) {}

  @Post(':userId')
  blockUser(
    @Req() request: JwtRequest,
    @Param('userId') userId: string,
  ) {
    return this.blocksService.blockUser(
      request.user.userId,
      userId,
    );
  }

  @Delete(':userId')
  unblockUser(
    @Req() request: JwtRequest,
    @Param('userId') userId: string,
  ) {
    return this.blocksService.unblockUser(
      request.user.userId,
      userId,
    );
  }

  @Get()
  getBlockedUsers(
    @Req() request: JwtRequest,
  ) {
    return this.blocksService.getBlockedUsers(
      request.user.userId,
    );
  }

  @Get(':userId')
  isBlocked(
    @Req() request: JwtRequest,
    @Param('userId') userId: string,
  ) {
    return this.blocksService.isBlocked(
      request.user.userId,
      userId,
    );
  }
}
