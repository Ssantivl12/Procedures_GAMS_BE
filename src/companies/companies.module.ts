import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { AuditService } from '../audit/audit.service';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [CasesModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, AuditService],
})
export class CompaniesModule {}