import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ProceduresService } from './procedures.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignInspectorDto } from './dto/assign-inspector.dto';
import { QueryProceduresDto } from './dto/query-procedures.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CloseCycleDto } from './dto/close-cycle.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/constants/role.constants';

@Controller('procedures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  // ---------------------------------------------------------------------------
  // Procedure CRUD
  // ---------------------------------------------------------------------------

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProcedureDto, @Req() req: any) {
    return this.proceduresService.create(dto, req.user.sub);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findAll(@Query() query: QueryProceduresDto) {
    return this.proceduresService.findAll(query);
  }

  // IMPORTANT: routes with literal second segments (:id/status, :id/assign,
  // :id/cycles, :id/audit) must all appear BEFORE the plain :id PATCH/GET
  // handlers so NestJS does not accidentally capture "status", "assign", etc.
  // as an :id value. Different path depths (2 vs 1 segments) are handled
  // correctly by NestJS, but declaring specific routes first is best practice.

  @Get(':id/audit')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  getAudit(@Param('id') id: string) {
    return this.proceduresService.getAuditHistory(id);
  }

  // ---------------------------------------------------------------------------
  // Cycle endpoints — all nested under :id/cycles
  // ---------------------------------------------------------------------------

  @Post(':id/cycles')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA)
  @HttpCode(HttpStatus.CREATED)
  createCycle(@Param('id') id: string, @Body() dto: CreateCycleDto, @Req() req: any) {
    return this.proceduresService.createCycle(id, dto, req.user.sub);
  }

  @Get(':id/cycles')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findAllCycles(@Param('id') id: string) {
    return this.proceduresService.findAllCycles(id);
  }

  // IMPORTANT: :id/cycles/:cycleId/close must be declared BEFORE :id/cycles/:cycleId
  // so NestJS does not treat "close" as a :cycleId value.
  @Patch(':id/cycles/:cycleId/close')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.INSPECTOR)
  @HttpCode(HttpStatus.OK)
  closeCycle(
    @Param('id') id: string,
    @Param('cycleId') cycleId: string,
    @Body() dto: CloseCycleDto,
    @Req() req: any,
  ) {
    return this.proceduresService.closeCycle(id, cycleId, dto, req.user.sub);
  }

  @Get(':id/cycles/:cycleId')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findOneCycle(@Param('id') id: string, @Param('cycleId') cycleId: string) {
    return this.proceduresService.findOneCycle(id, cycleId);
  }

  // ---------------------------------------------------------------------------
  // Status & assignment — :id/status and :id/assign before plain :id PATCH
  // ---------------------------------------------------------------------------

  @Patch(':id/status')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  @HttpCode(HttpStatus.OK)
  changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto, @Req() req: any) {
    return this.proceduresService.changeStatus(id, dto, req.user.sub, req.user.roles);
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO)
  @HttpCode(HttpStatus.OK)
  assignInspector(@Param('id') id: string, @Body() dto: AssignInspectorDto, @Req() req: any) {
    return this.proceduresService.assignInspector(id, dto, req.user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO)
  update(@Param('id') id: string, @Body() dto: UpdateProcedureDto, @Req() req: any) {
    return this.proceduresService.update(id, dto, req.user.sub);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findOne(@Param('id') id: string) {
    return this.proceduresService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.proceduresService.remove(id, req.user.sub);
  }
}
