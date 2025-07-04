import { Test, TestingModule } from '@nestjs/testing';
import { FacultadService } from './facultad.service';

describe('FacultadService', () => {
  let service: FacultadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FacultadService],
    }).compile();

    service = module.get<FacultadService>(FacultadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
