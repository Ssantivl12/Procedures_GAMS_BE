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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/constants/role.constants';
import { NonWorkingDaysService } from './non-working-days.service';
import { CreateNonWorkingDayDto } from './dto/create-non-working-day.dto';
import { BulkNonWorkingDaysDto } from './dto/bulk-non-working-days.dto';
import { QueryNonWorkingDaysDto } from './dto/query-non-working-days.dto';
import { UpdateNonWorkingDayDto } from './dto/update-non-working-day.dto';

@Controller('config/non-working-days')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NonWorkingDaysController {
  constructor(private readonly service: NonWorkingDaysService) {}

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findAll(@Query() query: QueryNonWorkingDaysDto) {
    return this.service.findAll(query);
  }

  // NOTE: /bulk must be declared before /:id to prevent route shadowing
  @Post('bulk')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  bulkCreate(@Body() dto: BulkNonWorkingDaysDto, @Req() req: any) {
    return this.service.bulkCreate(dto, req.user?.sub);
  }

  @Post()
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateNonWorkingDayDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNonWorkingDayDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.service.deactivate(id);
  }
}
