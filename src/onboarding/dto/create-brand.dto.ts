import {
  IsString,
  IsOptional,
  IsUrl,
  IsArray,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class SocialLinkDto {
  @IsUrl()
  url: string;
}

export class CreateBrandDto {
  @IsString()
  @MinLength(2)
  brandName: string;

  @IsString()
  brandType: string;

  @IsOptional()
  @IsString()
  brandLogo?: string;

  @IsOptional()
  @IsString() // Note: You might want to add brandColor to your Prisma Brand model later
  brandColor?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks: SocialLinkDto[];
}
