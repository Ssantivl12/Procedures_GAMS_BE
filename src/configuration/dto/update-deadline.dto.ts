import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// PATCH only allows updating deadlineDays and description — not procedureType or cycleNumber
export class UpdateDeadlineDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  deadlineDays?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
