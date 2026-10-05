import { Controller, Post } from '@nestjs/common';
import { CeleryService } from './celery.service.js';

@Controller('celery')
export class CeleryController {
  constructor(private readonly celeryService: CeleryService) {}

  @Post('test')
  testTask() {
    return this.celeryService.sendTestTask();
  }
}
