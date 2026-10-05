import { Module } from '@nestjs/common';
import { CeleryController } from './celery.controller.js';
import { CeleryService } from './celery.service.js';

@Module({
  controllers: [CeleryController],
  providers: [CeleryService],
  exports: [CeleryService],
})
export class CeleryModule {}
