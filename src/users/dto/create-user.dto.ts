import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/constants/role.constants';
import { USER_MESSAGES } from '../../common/constants/user.constants';
import { AUTH } from '../../common/constants/auth.constants';

export class CreateUserDto {
  @IsEmail({}, { message: USER_MESSAGES.VALIDATION.EMAIL_INVALID })
  @IsNotEmpty({ message: USER_MESSAGES.VALIDATION.EMAIL_REQUIRED })
  email: string;

  @IsString({ message: USER_MESSAGES.VALIDATION.PASSWORD_STRING })
  @IsNotEmpty({ message: USER_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
  @MinLength(8, { message: USER_MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH })
  @Matches(AUTH.PASSWORD.COMPLEXITY_REGEX, { message: AUTH.PASSWORD.COMPLEXITY_MESSAGE })
  password: string;

  @IsString({ message: USER_MESSAGES.VALIDATION.FIRSTNAME_STRING })
  @IsNotEmpty({ message: USER_MESSAGES.VALIDATION.FIRSTNAME_REQUIRED })
  firstName: string;

  @IsString({ message: USER_MESSAGES.VALIDATION.LASTNAME_STRING })
  @IsNotEmpty({ message: USER_MESSAGES.VALIDATION.LASTNAME_REQUIRED })
  lastName: string;

  @IsArray({ message: USER_MESSAGES.VALIDATION.ROLES_ARRAY })
  @IsEnum(UserRole, {
    each: true,
    message: USER_MESSAGES.VALIDATION.ROLES_KEY_ENUM,
  })
  @IsNotEmpty({ message: USER_MESSAGES.VALIDATION.ROLES_REQUIRED })
  roles: UserRole[];
}
