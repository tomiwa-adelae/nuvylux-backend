import { DeliveryMode, ServiceStatus, ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  IsArray,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsString()
  @MaxLength(120)
  shortDescription: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  price: string;

  @IsString()
  pricingType: 'FIXED' | 'HOURLY';

  @IsString()
  currency: string;

  @IsEnum(ServiceType)
  type: ServiceType;

  @IsEnum(DeliveryMode)
  deliveryMode: DeliveryMode;

  @IsOptional()
  @Type(() => Number)
  @Min(15)
  duration?: number;

  @IsOptional()
  @IsString()
  deliveryTimeline?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  revisions: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationPolicy?: string;

  @IsEnum(ServiceStatus)
  status: ServiceStatus;

  // Base64 images
  @IsArray()
  @IsOptional()
  images: string[];

  @IsString()
  @IsOptional()
  thumbnail: string;

  @IsOptional()
  @IsString()
  bookingRules?: string;
}
