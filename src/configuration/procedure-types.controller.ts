import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/constants/role.constants';
import { ProcedureTypesService } from './procedure-types.service';
import { UpdateProcedureTypeDto } from './dto/update-procedure-type.dto';

@Controller('config/procedure-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcedureTypesController {
  constructor(private readonly service: ProcedureTypesService) {}

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProcedureTypeDto,
  ) {
    return this.service.update(id, dto);
  }
}
