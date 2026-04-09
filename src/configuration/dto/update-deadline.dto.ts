import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDeadlineDto {
  @IsInt()
  @Min(1)
  deadlineDays: number;

  @IsOptional()
  @IsString()
  description?: string;
}
