// src/upload/upload.controller.ts
import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UploadedFiles,
  Delete,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('profile/:userId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @Param('userId') userId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadService.uploadProfilePicture(userId, file);
  }

  @Post('brand-logo/:userId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBrandLogo(
    @UploadedFile() file: Express.Multer.File,
    @Param('userId') userId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadService.uploadBrandLogo(userId, file);
  }

  /** Upload an image for use inside the rich-text editor. Returns { url }. */
  @Post('editor-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEditorImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadService.uploadEditorImage(file);
  }

  /** Upload a blog post cover image. Returns { url }. */
  @Post('post-cover')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPostCover(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadService.uploadPostCover(file);
  }
}
