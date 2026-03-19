import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, Matches } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  // raiNumber is NOT allowed at creation — only assigned via PATCH after RAI approval
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/, { message: 'RAI number debe tener exactamente 9 dígitos' })
  raiNumber?: string;
}