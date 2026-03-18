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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/constants/role.constants';

@Controller('procedures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

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

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findOne(@Param('id') id: string) {
    return this.proceduresService.findOne(id);
  }

  // IMPORTANT: :id/status and :id/assign must be declared BEFORE :id PATCH
  // to prevent NestJS treating "status"/"assign" as the :id param.
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

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.proceduresService.remove(id, req.user.sub);
  }
}
