import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserProfileDto } from 'src/auth/dto/update-user-profile.dto';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    if (!userId) throw new NotFoundException('UserID not found');

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) throw new NotFoundException('User not found');

      let baseUsername = slugify(`${dto.firstName} ${dto.lastName}`);
      let username = baseUsername;
      let counter = 1;

      while (await this.prisma.user.findUnique({ where: { username } })) {
        // Append a number if username exists
        username = `${baseUsername}-${counter}`;
        counter++;
      }

      // Update the user
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { ...dto, username },
        include: {
          brand: { include: { socials: true } },
          roles: true,
        },
      });

      // Remove sensitive data before returning
      const { password, refreshToken, ...result } = updatedUser;

      return {
        message: 'Settings updated successfully',
        user: result,
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'User with this email address already exist.',
        );
      }

      throw new BadRequestException(
        'Unable to update this profile at this time.',
      );
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!userId) throw new NotFoundException('UserID not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');

    // 1. Verify current password
    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password!,
    );

    if (!isPasswordValid) {
      throw new BadRequestException(
        'The current password you entered is incorrect',
      );
    }

    // 2. Hash and save new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }
}
