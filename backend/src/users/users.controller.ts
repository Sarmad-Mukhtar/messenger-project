import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface JwtRequest extends Request {
  user: {
    userId: string;
    email: string;
    username: string;
  };
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('search')
  searchUsers(
    @Req() request: JwtRequest,
    @Query('username') username: string,
  ) {
    return this.usersService.searchUsers(
      username || '',
      request.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() request: JwtRequest) {
    return this.usersService.getProfile(
      request.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(
    @Req() request: JwtRequest,
    @Body()
    body: {
      displayName?: string;
      avatarUrl?: string | null;
    },
  ) {
    return this.usersService.updateProfile(
      request.user.userId,
      body.displayName,
      body.avatarUrl,
    );
  }
}
