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
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseFileDto } from './dto/create-case-file.dto';
import { UpdateCaseFileDto } from './dto/update-case-file.dto';
import { QueryCaseFilesDto } from './dto/query-case-files.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/constants/role.constants';
import { CASE_FILE_MESSAGES } from '../common/constants/case-file.constants';

@Controller('case-files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.ENCARGADO)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCaseFileDto, @Req() req: any) {
    return this.casesService.create(dto, req.user.sub);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.INSPECTOR, UserRole.ENCARGADO)
  findAll(@Query() query: QueryCaseFilesDto, @Req() req: any) {
    const isSuperAdmin = req.user.roles.includes(UserRole.SUPERADMIN);
    if (!isSuperAdmin && query.isActive === false) {
      throw new ForbiddenException(CASE_FILE_MESSAGES.ERROR.FORBIDDEN_INACTIVE);
    }
    return this.casesService.findAll(query);
  }

  // IMPORTANT: this route must be declared BEFORE /:id to avoid NestJS
  // treating the literal string "company" as an :id param.
  @Get('company/:companyId')
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.INSPECTOR, UserRole.ENCARGADO)
  findByCompany(@Param('companyId') companyId: string) {
    return this.casesService.findByCompanyId(companyId);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.INSPECTOR, UserRole.ENCARGADO)
  findOne(@Param('id') id: string) {
    return this.casesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO)
  update(@Param('id') id: string, @Body() dto: UpdateCaseFileDto, @Req() req: any) {
    return this.casesService.update(id, dto, req.user.sub);
  }

  // IMPORTANT: :id/close must be declared before a generic :id PATCH handler
  // to avoid ambiguity. NestJS resolves literal segments before params.
  @Patch(':id/close')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO)
  @HttpCode(HttpStatus.OK)
  close(@Param('id') id: string, @Req() req: any) {
    return this.casesService.close(id, req.user.sub);
  }

  @Patch(':id/reopen')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  reopen(@Param('id') id: string, @Req() req: any) {
    return this.casesService.reopen(id, req.user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.casesService.remove(id, req.user.sub);
  }
}
