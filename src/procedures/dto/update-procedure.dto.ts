import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { CompanyStatus } from '@prisma/client';

export class UpdateProcedureDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  routeSheetNumber?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  companyStatus?: CompanyStatus;

  @IsOptional()
  @IsString()
  generalNotes?: string;
}
