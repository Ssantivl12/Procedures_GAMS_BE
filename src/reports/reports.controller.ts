import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/constants/role.constants';
import { ReportsService } from './reports.service';
import { QueryReportsDto } from './dto/query-reports.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  private isInspector(req: any): boolean {
    return req.user?.roles?.includes(UserRole.INSPECTOR) ?? false;
  }

  private sendCsvOrJson(res: any, result: any, reportName: string) {
    if (result && typeof result === 'object' && 'csv' in result) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reporte_${reportName}_${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      return res.send(result.csv);
    }
    return res.json(result);
  }

  @Get('procedures')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  async getProcedures(@Query() query: QueryReportsDto, @Req() req: any, @Res() res: any) {
    const result = await this.service.getProcedures(query, req.user.sub, this.isInspector(req));
    return this.sendCsvOrJson(res, result, 'tramites');
  }

  @Get('companies')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  async getCompanies(@Query() query: QueryReportsDto, @Res() res: any) {
    const result = await this.service.getCompanies(query);
    return this.sendCsvOrJson(res, result, 'empresas');
  }

  @Get('expired-rai')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  async getExpiredRai(@Query() query: QueryReportsDto, @Res() res: any) {
    const result = await this.service.getExpiredRai(query);
    return this.sendCsvOrJson(res, result, 'rai_vigencias');
  }

  @Get('iaa-status')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  async getIaaStatus(@Query() query: QueryReportsDto, @Res() res: any) {
    const result = await this.service.getIaaStatus(query);
    return this.sendCsvOrJson(res, result, 'iaa_estado');
  }

  @Get('activity')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO)
  async getActivity(@Query() query: QueryReportsDto, @Res() res: any) {
    const result = await this.service.getActivity(query);
    return this.sendCsvOrJson(res, result, 'actividad');
  }
}
