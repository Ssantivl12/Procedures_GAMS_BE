import { IsOptional, IsString } from 'class-validator';

export class UpdateNonWorkingDayDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
