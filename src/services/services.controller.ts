import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Patch,
  Param,
  BadRequestException,
  Get,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { Response, Request as ExpressRequest } from 'express';

// src/services/services.controller.ts
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'thumbnail', maxCount: 1 }, // name must match frontend formData key
      { name: 'images', maxCount: 5 }, // name must match frontend formData key
    ]),
  )
  async create(
    @Req() req: ExpressRequest,
    @UploadedFiles()
    files: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Body() body: CreateServiceDto,
  ) {
    // 1. Safety check: If no files object at all
    if (!files) {
      throw new BadRequestException(
        'No files were uploaded. Ensure you are using FormData on the frontend.',
      );
    }

    // 2. Extract safely
    const thumbnailFile = files.thumbnail?.[0];
    const galleryFiles = files.images || [];

    // 3. Validation
    if (!thumbnailFile)
      throw new BadRequestException('Thumbnail image is required');
    if (galleryFiles.length === 0)
      throw new BadRequestException('At least one gallery image is required');

    return this.servicesService.create(
      // @ts-ignore
      req?.user?.id!,
      body,
      thumbnailFile,
      galleryFiles,
    );
  }

  @Get('my-services')
  async findMyServices(@Req() req: ExpressRequest) {
    // @ts-ignore
    const userId = req.user.id;
    return this.servicesService.findAllByProfessional(userId);
  }
}
