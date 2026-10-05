import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface JwtRequest extends Request {
  user: {
    userId: string;
    email: string;
    username: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  getNotifications(
    @Req() request: JwtRequest,
  ) {
    return this.notificationsService.getNotifications(
      request.user.userId,
    );
  }

  @Get('unread')
  getUnreadNotifications(
    @Req() request: JwtRequest,
  ) {
    return this.notificationsService.getUnreadNotifications(
      request.user.userId,
    );
  }

  @Get('unread/count')
  getUnreadCount(
    @Req() request: JwtRequest,
  ) {
    return this.notificationsService.getUnreadCount(
      request.user.userId,
    );
  }

  @Post(':notificationId/read')
  markAsRead(
    @Req() request: JwtRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(
      request.user.userId,
      notificationId,
    );
  }

  @Post('read-all')
  markAllAsRead(
    @Req() request: JwtRequest,
  ) {
    return this.notificationsService.markAllAsRead(
      request.user.userId,
    );
  }
}
