import { Module } from '@nestjs/common';
import { ConfigCacheService } from './config-cache.service';
import { DeadlinesController } from './deadlines.controller';
import { DeadlinesService } from './deadlines.service';
import { NonWorkingDaysController } from './non-working-days.controller';
import { NonWorkingDaysService } from './non-working-days.service';
import { ProcedureTypesController } from './procedure-types.controller';
import { ProcedureTypesService } from './procedure-types.service';

@Module({
  controllers: [DeadlinesController, NonWorkingDaysController, ProcedureTypesController],
  providers: [
    ConfigCacheService,
    DeadlinesService,
    NonWorkingDaysService,
    ProcedureTypesService,
  ],
  exports: [ConfigCacheService],
})
export class ConfigurationModule {}
