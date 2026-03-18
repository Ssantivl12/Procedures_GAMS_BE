import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateNonWorkingDayDto {
  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string; // NACIONAL | DEPARTAMENTAL | MUNICIPAL | OTRO
}
