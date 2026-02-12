import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenRequestDto,
  ChangePasswordRequestDto,
} from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../common/constants/role.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
  ): Promise<LoginResponseDto> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: any, @Body('refreshToken') refreshToken?: string) {
    const user = req.user;
    await this.authService.logout(user.sub, refreshToken);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() req: any,
    @Body() dto: ChangePasswordRequestDto,
  ) {
    const user = req.user;
    await this.authService.changePassword(user.sub, dto);
  }

  // No hay endpoint público de registro
}