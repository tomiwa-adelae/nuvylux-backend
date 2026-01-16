import { PartialType } from '@nestjs/mapped-types';
import { CreateSavedDto } from './create-saved.dto';

export class UpdateSavedDto extends PartialType(CreateSavedDto) {}
