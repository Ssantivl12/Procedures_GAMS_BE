import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/constants/role.constants';
import { DeadlinesService } from './deadlines.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';

@Controller('config/deadlines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeadlinesController {
  constructor(private readonly service: DeadlinesService) {}

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

  @Post()
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDeadlineDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDeadlineDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.service.deactivate(id);
  }
}
