import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { plainToClass } from 'class-transformer';
import Mailjet from 'node-mailjet';
import slugify from 'slugify';
import { UserResponseDto } from './dto/user-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { notDeleted } from 'src/utils/prismaFilters';
import { RegisterUserDto } from './dto/register-user.dto';
import { WelcomeEmail } from 'emails/welcome-email';
import { ForgotPasswordEmail } from 'emails/forgot-password-email';

const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_PUBLIC_KEY!,
  process.env.MAILJET_API_PRIVATE_KEY!,
);

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: UserResponseDto;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  isTwoFactorAuthenticated?: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  getAcronym(name?: string) {
    if (!name) return 'EMS';

    const words = name.trim().split(/\s+/);
    return words
      .slice(0, 3)
      .map((word) => word[0]?.toUpperCase())
      .join('');
  }

  generatePrefix(length = 4): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  getCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';

    return {
      httpOnly: true,
      secure: isProd,
      // 'none' is required for cross-domain cookies (Vercel <-> Render).
      // 'lax' is fine for same-origin local dev.
      sameSite: isProd ? ('none' as const) : ('lax' as const),
      // Do NOT set domain when frontend and backend are on different TLDs.
      // The browser scopes the cookie to the backend's own domain automatically.
      path: '/',
    };
  }

  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });
  }

  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });
  }

  async hashRefreshToken(refreshToken: string): Promise<string> {
    return bcrypt.hash(refreshToken, 10);
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email, ...notDeleted() },
    });

    if (!user) return null;
    if (!user.password)
      throw new UnauthorizedException(
        'This account uses google sign-in. Please use "Continue with Google" button',
      );

    if (await bcrypt.compare(password, user.password)) {
      const { password, refreshToken, ...result } = user;

      return result;
    }

    return null;
  }

  async login(user: any) {
    // Normal login flow (no 2FA required)
    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      isTwoFactorAuthenticated: false,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: plainToClass(UserResponseDto, updatedUser, {
        excludeExtraneousValues: true,
      }),
    };
  }

  async register(registerUserDto: RegisterUserDto) {
    if (registerUserDto.password !== registerUserDto.confirmPassword)
      throw new ConflictException('Password do not match');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerUserDto.email },
    });

    if (existingUser) throw new ConflictException('User already exists');

    const hashedPassword = await bcrypt.hash(registerUserDto.password, 10);

    let baseUsername = slugify(
      `${registerUserDto.firstName} ${registerUserDto.lastName}`,
    );
    let username = baseUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      // Append a number if username exists
      username = `${baseUsername}-${counter}`;
      counter++;
    }

    const user = await this.prisma.user.create({
      data: {
        firstName: registerUserDto.firstName,
        lastName: registerUserDto.lastName,
        email: registerUserDto.email,
        password: hashedPassword,
        username,
        role: 'USER',
      },
    });

    await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.SENDER_EMAIL_ADDRESS,
            Name: 'Nuvylux',
          },
          To: [{ Email: user.email, Name: user.firstName }],
          Subject: `Welcome to Nuvylux, ${user.firstName}`,
          HTMLPart: WelcomeEmail({
            firstName: user.firstName,
          }),
        },
      ],
    });

    const { password, refreshToken, ...result } = user;

    return this.login(result);
  }

  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, ...notDeleted() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        onboardingCompleted: true,
      },
    });

    if (!user) throw new ConflictException('Oops! User not found');

    return user;
  }

  async verifyCode(otp: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, ...notDeleted() },
    });

    if (!user) throw new NotFoundException('No account with that email');

    if (!user.resetOTP)
      throw new UnauthorizedException('Invalid or expired OTP');

    if (user.resetOTPExpiry! < new Date())
      throw new UnauthorizedException('OTP has expired');

    const isValid = await bcrypt.compare(otp, user.resetOTP);
    if (!isValid) throw new UnauthorizedException('Invalid OTP');

    return { message: 'OTP verification successful' };
  }

  async setNewPassword({
    email,
    otp,
    newPassword,
    confirmPassword,
  }: {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    if (newPassword !== confirmPassword)
      throw new BadRequestException('Passwords do not match');

    const user = await this.prisma.user.findUnique({
      where: { email, ...notDeleted() },
    });

    if (!user) throw new NotFoundException('No account with that email');

    if (!user.resetOTP)
      throw new UnauthorizedException('Invalid or expired OTP');

    if (user.resetOTPExpiry! < new Date())
      throw new UnauthorizedException('OTP has expired');

    const isValid = await bcrypt.compare(otp, user.resetOTP);
    if (!isValid) throw new UnauthorizedException('Invalid OTP');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { email },
      data: { password: hashedPassword, resetOTP: null, resetOTPExpiry: null },
    });

    return { message: 'Password reset successfully.' };
  }

  async sendPasswordResetOTP(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, ...notDeleted() },
    });

    if (!user) throw new NotFoundException('No account with that email');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    const hashedOTP = await bcrypt.hash(otp, 10);

    await this.prisma.user.update({
      where: { email },
      data: { resetOTP: hashedOTP, resetOTPExpiry: expiry },
    });

    await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.SENDER_EMAIL_ADDRESS,
            Name: 'Nuvylux',
          },
          To: [{ Email: email, Name: user.firstName }],
          Subject: `Password Reset Code`,
          HTMLPart: ForgotPasswordEmail({
            firstName: user.firstName,
            otp,
          }),
        },
      ],
    });

    return { message: 'Password reset OTP sent to your email' };
  }

  async logout(refreshToken: string) {
    const users = await this.prisma.user.findMany({
      where: {},
      select: { id: true, refreshToken: true },
    });

    for (const user of users) {
      if (user.refreshToken && refreshToken === user.refreshToken) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
      }
    }

    return { message: 'User logged out' };
  }

  async refreshTokens(refreshToken: string) {
    const users = await this.prisma.user.findMany({
      where: { refreshToken: { not: null } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        refreshToken: true,
      },
    });

    for (const user of users) {
      const match = user.refreshToken === refreshToken;

      if (match) {
        // valid refresh token
        const accessToken = this.jwtService.sign(
          { sub: user.id },
          { expiresIn: '15m' },
        );
        const newRefreshToken = this.jwtService.sign(
          { sub: user.id },
          { expiresIn: '7d' },
        );

        await this.prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: newRefreshToken },
        });

        return { accessToken, newRefreshToken, user };
      } else {
      }
    }
    return null;
  }
}
