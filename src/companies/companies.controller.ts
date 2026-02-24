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
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/constants/role.constants';
import { COMPANY_MESSAGES } from '../common/constants/company.constants';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.ENCARGADO)
  async create(@Body() dto: CreateCompanyDto, @Req() req: any) {
    const user = req.user;
    return this.companiesService.create(dto, user.sub);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.INSPECTOR, UserRole.ENCARGADO)
  async findAll(@Query() query: QueryCompaniesDto, @Req() req: any) {
    const user = req.user;
    const isSuperAdmin = user.roles.includes(UserRole.SUPERADMIN);
    if (!isSuperAdmin && query.isActive === false) {
      throw new ForbiddenException(COMPANY_MESSAGES.ERROR.FORBIDDEN_INACTIVE);
    }
    return this.companiesService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.INSPECTOR, UserRole.ENCARGADO)
  async findOne(@Param('id') id: string, @Query('include') include?: string, @Req() req?: any) {
    const company = await this.companiesService.findOne(id, include === 'caseFile');
    if (!company) throw new NotFoundException(COMPANY_MESSAGES.ERROR.NOT_FOUND);
    
    if (!company.isActive && !req?.user?.roles.includes(UserRole.SUPERADMIN)) {
      throw new NotFoundException(COMPANY_MESSAGES.ERROR.NOT_FOUND);
    }
    return company;
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.ENCARGADO)
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @Req() req: any) {
    const user = req.user;
    const company = await this.companiesService.findOne(id);
    if (!company) throw new NotFoundException(COMPANY_MESSAGES.ERROR.NOT_FOUND);
    if (!company.isActive && !user.roles.includes(UserRole.SUPERADMIN)) {
      throw new NotFoundException(COMPANY_MESSAGES.ERROR.NOT_FOUND);
    }
    return this.companiesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    const company = await this.companiesService.findOne(id);
    if (!company) throw new NotFoundException(COMPANY_MESSAGES.ERROR.NOT_FOUND);
    if (!company.isActive) {
      throw new ConflictException(COMPANY_MESSAGES.ERROR.ALREADY_DELETED);
    }
    
    const hasActiveCaseFile = await this.companiesService.hasActiveCaseFile(id);
    if (hasActiveCaseFile) {
      throw new ConflictException(COMPANY_MESSAGES.ERROR.HAS_ACTIVE_CASE_FILE);
    }
    
    return this.companiesService.remove(id, user.sub);
  }

  @Get(':id/case-file')
  @Roles(UserRole.SUPERADMIN, UserRole.SECRETARIA, UserRole.INSPECTOR, UserRole.ENCARGADO)
  async getCaseFile(@Param('id') id: string) {
    const caseFile = await this.companiesService.getCaseFile(id);
    if (!caseFile) throw new NotFoundException(COMPANY_MESSAGES.ERROR.NOT_FOUND);
    return caseFile;
  }
}