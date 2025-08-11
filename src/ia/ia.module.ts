import { Module } from '@nestjs/common';
import { IaService } from './ia.service';

@Module({
      providers: [IaService],
})
export class IaModule {}
