import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AUTH } from '../../common/constants/auth.constants';

export class ChangePasswordRequestDto {
  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  @MaxLength(AUTH.PASSWORD.MAX_LENGTH)
  currentPassword: string;

  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  @MaxLength(AUTH.PASSWORD.MAX_LENGTH)
  @Matches(AUTH.PASSWORD.COMPLEXITY_REGEX, { message: AUTH.PASSWORD.COMPLEXITY_MESSAGE })
  newPassword: string;

  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  @MaxLength(AUTH.PASSWORD.MAX_LENGTH)
  @Matches(AUTH.PASSWORD.COMPLEXITY_REGEX, { message: AUTH.PASSWORD.COMPLEXITY_MESSAGE })
  confirmPassword: string;
}