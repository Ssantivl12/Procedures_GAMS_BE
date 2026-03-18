import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ObservationsService } from './observations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/constants/role.constants';

@Controller('cycles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CycleObservationsController {
  constructor(private readonly observationsService: ObservationsService) {}

  @Get(':cycleId/observations')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findByCycle(@Param('cycleId') cycleId: string) {
    return this.observationsService.findByCycle(cycleId);
  }
}
