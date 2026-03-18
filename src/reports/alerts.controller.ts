import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/constants/role.constants';
import { AlertsService } from './alerts.service';
import { QueryAlertsDto } from './dto/query-alerts.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  private isInspector(req: any): boolean {
    return req.user?.roles?.includes(UserRole.INSPECTOR) ?? false;
  }

  @Get('overdue')
  getOverdue(@Query() query: QueryAlertsDto, @Req() req: any) {
    return this.service.getOverdue(query, req.user.sub, this.isInspector(req));
  }

  @Get('due-soon')
  getDueSoon(@Query() query: QueryAlertsDto, @Req() req: any) {
    return this.service.getDueSoon(query, req.user.sub, this.isInspector(req));
  }

  @Get('pending-pickup')
  getPendingPickup(@Query() query: QueryAlertsDto, @Req() req: any) {
    return this.service.getPendingPickup(query, req.user.sub, this.isInspector(req));
  }

  @Get('rai-expiration')
  getRaiExpiration(@Query() query: QueryAlertsDto) {
    return this.service.getRaiExpiration(query);
  }

  @Get('iaa-missing')
  getIaaMissing(@Query() query: QueryAlertsDto) {
    return this.service.getIaaMissing(query);
  }

  @Get('summary')
  getSummary(@Req() req: any) {
    return this.service.getSummary(req.user.sub, this.isInspector(req));
  }
}
