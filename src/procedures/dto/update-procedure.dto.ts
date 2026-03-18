import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProcedureDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  routeSheetNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  internalFileNumber?: string;

  @IsOptional()
  @IsString()
  generalNotes?: string;
}
