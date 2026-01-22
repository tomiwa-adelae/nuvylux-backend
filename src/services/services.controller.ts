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
  Query,
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
import { Public } from 'src/decorators/public.decorator';

// src/services/services.controller.ts
@Controller('services')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  // @Roles(Role.PROFESSIONAL)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'thumbnail', maxCount: 1 }, // name must match frontend formData key
      { name: 'images', maxCount: 6 }, // name must match frontend formData key
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
    try {
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
    } catch (error) {
      throw new BadRequestException('Oops! An error occurred');
    }
  }

  @Get('')
  // @Roles(Role.PROFESSIONAL)
  async findMyServices(@Req() req: ExpressRequest) {
    // @ts-ignore
    const userId = req.user.id;
    return this.servicesService.findAllByProfessional(userId);
  }

  @Get('/:slug')
  // @Roles(Role.PROFESSIONAL)
  getProductDetails(
    @Req() req: ExpressRequest,
    @Param('slug') serviceSlug: string,
  ) {
    return this.servicesService.getServiceDetails(
      // @ts-ignore
      req?.user?.id!,
      serviceSlug,
    );
  }

  @Patch('/:id')
  // @Roles(Role.PROFESSIONAL)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'thumbnail', maxCount: 1 },
      { name: 'images', maxCount: 5 },
    ]),
  )
  async update(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Body() body: any, // Use 'any' or a specialized DTO because of FormData strings
  ) {
    const newThumbnail = files?.thumbnail?.[0];
    const newGallery = files?.images || [];

    // Parse existing data sent from frontend strings/JSON
    const existingThumbnail = body.existingThumbnail;
    const existingImages = body.existingImages
      ? JSON.parse(body.existingImages)
      : [];

    return this.servicesService.update(
      id,
      body,
      newThumbnail,
      newGallery,
      existingThumbnail,
      existingImages,
    );
  }

  @Get('/public/explore')
  // @Public() // If your setup requires this to bypass JwtAuthGuard
  async getExploreServices(
    @Req() req: ExpressRequest,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    // @ts-ignore - userId is optional here
    const userId = req.user?.id;
    return this.servicesService.getPublicServices(userId, { type, search });
  }

  @Get('public/:slug')
  @Public()
  async getPublicDetails(
    @Req() req: ExpressRequest,
    @Param('slug') slug: string,
  ) {
    // @ts-ignore
    const userId = req.user?.id;
    return this.servicesService.getPublicServiceDetails(slug, userId);
  }
}
