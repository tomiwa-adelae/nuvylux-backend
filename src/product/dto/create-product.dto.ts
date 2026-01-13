import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsEnum,
  IsInt,
  MinLength,
  MaxLength,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AvailableColorDto {
  @IsString()
  name: string;

  @IsString()
  colorCode: string;
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  category: string;

  @IsUUID()
  brandId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  shortDescription: string;

  @IsString()
  @MinLength(2)
  description: string;

  // Prices are coming as strings → transform to number
  @IsString()
  price: string;

  @IsString()
  @IsOptional()
  compareAtPrice: string;

  @IsString()
  stock: string;

  @IsString()
  sku: string;

  @IsString()
  status: ProductStatus;

  @IsOptional()
  sizes: string[];

  @IsOptional()
  availableColors: any[];

  // Base64 images
  @IsArray()
  @IsOptional()
  images: string[];

  @IsString()
  @IsOptional()
  thumbnail: string;
}
