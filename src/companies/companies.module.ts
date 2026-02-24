import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, PrismaService, AuditService],
})
export class CompaniesModule {}