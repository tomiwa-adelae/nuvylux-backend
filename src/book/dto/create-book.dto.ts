import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateBookDto {
  @IsString()
  serviceId: string;

  @IsString()
  @IsOptional()
  date: string; // e.g. "2026-01-25"

  @IsString()
  @IsOptional()
  time: string; // e.g. "14:00"

  @IsString()
  @IsOptional()
  requirements: string;

  @IsArray()
  @IsOptional()
  images: string[];
}
