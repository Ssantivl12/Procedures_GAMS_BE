import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/constants/role.constants';
import { USER_MESSAGES } from '../../common/constants/user.constants';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: USER_MESSAGES.VALIDATION.EMAIL_INVALID })
  email?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.VALIDATION.PASSWORD_STRING })
  @MinLength(8, { message: USER_MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH })
  password?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.VALIDATION.FULLNAME_STRING })
  fullName?: string;

  @IsOptional()
  @IsArray({ message: USER_MESSAGES.VALIDATION.ROLES_ARRAY })
  @IsEnum(UserRole, {
    each: true,
    message: USER_MESSAGES.VALIDATION.ROLES_KEY_ENUM,
  })
  roles?: UserRole[];

  @IsOptional()
  @IsBoolean({ message: USER_MESSAGES.VALIDATION.IS_ACTIVE_BOOLEAN })
  isActive?: boolean;
}
