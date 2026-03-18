import { IsOptional, IsString, MinLength, MaxLength, IsIn } from 'class-validator';

export class UpdateObservationDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DOCUMENTAL', 'TECNICA', 'ADMINISTRATIVA', 'LEGAL', 'OTRA'])
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ALTA', 'MEDIA', 'BAJA'])
  priority?: string;
}
