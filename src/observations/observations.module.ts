import { Module } from '@nestjs/common';
import { ObservationsController } from './observations.controller';
import { CycleObservationsController } from './cycle-observations.controller';
import { ObservationsService } from './observations.service';
import { AuditService } from '../audit/audit.service';
import { SnapshotModule } from '../snapshot/snapshot.module';

@Module({
  imports: [SnapshotModule],
  controllers: [ObservationsController, CycleObservationsController],
  providers: [ObservationsService, AuditService],
  exports: [ObservationsService],
})
export class ObservationsModule {}
