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
import { ObservationsService } from './observations.service';
import { CreateObservationDto } from './dto/create-observation.dto';
import { UpdateObservationDto } from './dto/update-observation.dto';
import { ResolveObservationDto } from './dto/resolve-observation.dto';
import { QueryObservationsDto } from './dto/query-observations.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/constants/role.constants';

@Controller('procedures/:procedureId/observations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObservationsController {
  constructor(private readonly observationsService: ObservationsService) {}

  @Post()
  @Roles(UserRole.INSPECTOR, UserRole.ENCARGADO, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('procedureId') procedureId: string,
    @Body() dto: CreateObservationDto,
    @Req() req: any,
  ) {
    return this.observationsService.create(procedureId, dto, req.user.sub);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findAll(@Param('procedureId') procedureId: string, @Query() query: QueryObservationsDto) {
    return this.observationsService.findAll(procedureId, query);
  }

  // IMPORTANT: :id/resolve and :id/reopen must be declared BEFORE the plain :id
  // PATCH handler so NestJS does not treat "resolve" / "reopen" as an :id value.

  @Patch(':id/resolve')
  @Roles(UserRole.INSPECTOR, UserRole.ENCARGADO, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  resolve(
    @Param('procedureId') procedureId: string,
    @Param('id') id: string,
    @Body() dto: ResolveObservationDto,
    @Req() req: any,
  ) {
    return this.observationsService.resolve(procedureId, id, dto, req.user.sub);
  }

  @Patch(':id/reopen')
  @Roles(UserRole.ENCARGADO, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  reopen(
    @Param('procedureId') procedureId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.observationsService.reopen(procedureId, id, req.user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.INSPECTOR, UserRole.ENCARGADO, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  update(
    @Param('procedureId') procedureId: string,
    @Param('id') id: string,
    @Body() dto: UpdateObservationDto,
    @Req() req: any,
  ) {
    return this.observationsService.update(procedureId, id, dto, req.user.sub);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findOne(@Param('procedureId') procedureId: string, @Param('id') id: string) {
    return this.observationsService.findOne(procedureId, id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('procedureId') procedureId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.observationsService.remove(procedureId, id, req.user.sub);
  }
}
