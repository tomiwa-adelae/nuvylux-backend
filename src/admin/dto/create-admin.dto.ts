import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AdminPosition } from '@prisma/client';

export class CreateAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(AdminPosition)
  position: AdminPosition;
}
