import { Module } from '@nestjs/common';
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
  providers: [DashboardService, AlertsService, ReportsService],
})
export class ReportsModule {}
