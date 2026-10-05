import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { FriendsModule } from './friends/friends.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { UsersModule } from './users/users.module.js';
import { CeleryModule } from './celery/celery.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { BlocksModule } from './blocks/blocks.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';

export const { ObserveModule, ObserveInstrument } =
  createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),

    PrismaModule,
    AuthModule,
    FriendsModule,
    MessagesModule,
    UsersModule,
    CeleryModule,
    NotificationsModule,
    BlocksModule,
    AttachmentsModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}
