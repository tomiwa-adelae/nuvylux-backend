import { Exclude, Expose, Type } from 'class-transformer';

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

  @Exclude()
  provider?: string;

  // Add school info
  @Expose()
  schoolId?: string;

  @Expose()
  username?: string;

  @Expose()
  department?: string;

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

  @Expose()
  medicalConditions?: string;

  @Expose()
  title?: string;

  @Expose()
  Student?: any;

  @Expose()
  schoolRoles?: any;
}
