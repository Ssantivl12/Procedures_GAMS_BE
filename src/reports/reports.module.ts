import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { ConfigurationModule } from '../configuration/configuration.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ConfigurationModule],
  controllers: [DashboardController, AlertsController, ReportsController],
  providers: [PrismaService, DashboardService, AlertsService, ReportsService],
})
export class ReportsModule {}
