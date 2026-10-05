import { Module } from '@nestjs/common';

import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';

import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
