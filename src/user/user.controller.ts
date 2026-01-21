import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Put,
  Req,
} from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateUserProfileDto } from 'src/auth/dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Put('profile')
  async updateProfile(
    @Req() req: ExpressRequest,
    @Body() dto: UpdateUserProfileDto,
  ) {
    // @ts-ignore
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Patch('change-password')
  async changePassword(
    @Req() req: ExpressRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    // @ts-ignore
    return this.usersService.changePassword(req.user.id, dto);
  }
}
