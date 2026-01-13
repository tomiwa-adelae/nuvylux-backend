import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { Response, Request as ExpressRequest } from 'express';
import { RegisterUserDto } from './dto/register-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { SetNewPasswordDto } from './dto/set-new-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req, @Res() res: Response) {
    const loginResponse = await this.authService.login(req.user);

    // Normal login flow
    const { access_token, refresh_token, user } = loginResponse;

    const cookieOptions = this.authService.getCookieOptions();

    res.cookie('refreshToken', refresh_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('accessToken', access_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({ user, message: `Welcome back, ${user.firstName}` });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerUser(
    @Body() registerUser: RegisterUserDto,
    @Res() res: Response,
  ) {
    const { access_token, refresh_token, user } =
      await this.authService.register(registerUser);

    const cookieOptions = this.authService.getCookieOptions();

    res.cookie('refreshToken', refresh_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('accessToken', access_token, {
      ...cookieOptions,
      maxAge: 1 * 24 * 60 * 60 * 1000, // 15 minutes
    });

    return res.json({ user, message: `Welcome to Nuvylux, ${user.firstName}` });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: ExpressRequest, @Res() res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    const cookieOptions = this.authService.getCookieOptions();

    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('accessToken', cookieOptions);

    return res.json({ message: "You've been logged out successfully" });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.sendPasswordResetOTP(forgotPasswordDto.email);
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyCode(@Body() verifyCodeDto: VerifyCodeDto) {
    return this.authService.verifyCode(verifyCodeDto.otp, verifyCodeDto.email);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: ExpressRequest, @Res() res: Response) {
    const refreshToken = req.cookies?.refreshToken || req.cookies?.accessToken;

    if (!refreshToken)
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'No refresh token found' });

    const result = await this.authService.refreshTokens(refreshToken);

    if (!result)
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'Invalid refresh token' });

    const { accessToken, newRefreshToken, user } = result;

    const cookieOptions = this.authService.getCookieOptions();

    res.cookie('refreshToken', newRefreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 1 * 24 * 60 * 60 * 1000,
    });

    return res.json({ user });
  }

  @Post('set-new-password')
  @HttpCode(HttpStatus.OK)
  async setNewPassword(@Body() newPasswordDto: SetNewPasswordDto) {
    return this.authService.setNewPassword({
      email: newPasswordDto.email,
      otp: newPasswordDto.otp,
      newPassword: newPasswordDto.newPassword,
      confirmPassword: newPasswordDto.confirmPassword,
    });
  }
}
