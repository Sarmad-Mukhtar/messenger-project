import { Module } from '@nestjs/common';

import { BlocksController } from './blocks.controller.js';
import { BlocksService } from './blocks.service.js';

import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [
    BlocksController,
  ],
  providers: [
    BlocksService,
  ],
  exports: [
    BlocksService,
  ],
})
export class BlocksModule {}
