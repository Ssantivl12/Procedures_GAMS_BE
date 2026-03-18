import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/constants/role.constants';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  get(@Req() req: any) {
    return this.service.getDashboard(req.user.sub, req.user.roles ?? []);
  }
}
