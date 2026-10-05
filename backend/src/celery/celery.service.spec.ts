import { Test, TestingModule } from '@nestjs/testing';
import { CeleryService } from './celery.service.js';

describe('CeleryService', () => {
  let service: CeleryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CeleryService],
    }).compile();

    service = module.get<CeleryService>(CeleryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
