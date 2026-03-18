import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ProceduresService } from './procedures.service';
import { QueryProceduresDto } from './dto/query-procedures.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/constants/role.constants';

// Handles GET /case-files/:caseFileId/procedures
// Declared in its own controller to avoid collision with CasesController prefix.
@Controller('case-files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CaseFileProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Get(':caseFileId/procedures')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findByCaseFile(@Param('caseFileId') caseFileId: string, @Query() query: QueryProceduresDto) {
    return this.proceduresService.findAll({ ...query, caseFileId });
  }
}
