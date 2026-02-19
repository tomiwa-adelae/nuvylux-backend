import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  otherName: string;

  @Expose()
  createdAt: string;

  @Expose()
  updatedAt: string;

  @Exclude()
  password: string;

  @Expose()
  role: string;

  @Expose()
  onboardingCompleted: boolean;

  @Exclude()
  provider?: string;

  @Expose()
  username?: string;

  @Expose()
  image?: string;

  @Expose()
  city?: string;

  @Expose()
  address?: string;

  @Expose()
  state?: string;

  @Expose()
  country?: string;

  @Expose()
  dob?: string;

  @Expose()
  gender?: string;

  @Expose()
  phoneNumber?: string;
}
