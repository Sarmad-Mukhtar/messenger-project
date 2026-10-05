import { Module } from '@nestjs/common';

import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { MessagesGateway } from './messages.gateway.js';

import { PrismaModule } from '../prisma/prisma.module.js';
import { CeleryModule } from '../celery/celery.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    PrismaModule,
    CeleryModule,
    NotificationsModule,
  ],
  controllers: [
    MessagesController,
  ],
  providers: [
    MessagesService,
    MessagesGateway,
  ],
})
export class MessagesModule {}
