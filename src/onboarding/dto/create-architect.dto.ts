import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateArchitectDto {
  @IsString()
  @IsNotEmpty()
  profession: string;

  @IsString()
  @IsNotEmpty()
  yearsOfExperience: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  bio?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsUrl()
  @IsOptional()
  website?: string;
}
