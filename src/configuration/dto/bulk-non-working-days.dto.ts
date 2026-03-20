import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateNonWorkingDayDto } from './create-non-working-day.dto';

export class BulkNonWorkingDaysDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNonWorkingDayDto)
  dates: CreateNonWorkingDayDto[];
}
