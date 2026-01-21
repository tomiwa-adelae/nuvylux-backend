import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(2, { message: 'Password must be at least 2 characters' })
  currentPassword: string;

  @IsString()
  @MinLength(2, { message: 'New password must be at least 2 characters' })
  newPassword: string;

  @IsString()
  @MinLength(2, { message: 'Confirm password must be at least 2 characters' })
  confirmPassword: string;
}
