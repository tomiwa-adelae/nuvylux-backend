// dto/create-saved.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSavedDto {
  @IsNotEmpty()
  @IsString()
  productId: string;
}
