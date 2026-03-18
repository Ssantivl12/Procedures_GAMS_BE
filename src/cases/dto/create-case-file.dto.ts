import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCaseFileDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fileNumber?: string;
}
