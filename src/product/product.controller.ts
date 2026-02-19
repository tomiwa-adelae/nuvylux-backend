import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { Response, Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import { Public } from 'src/decorators/public.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @Roles(Role.USER, Role.CLIENT, Role.BRAND)
  getProducts(@Req() req: ExpressRequest) {
    return this.productService.getProducts(
      // @ts-ignore
      req?.user?.id!,
    );
  }

  @Get('/:slug')
  @Roles(Role.USER, Role.CLIENT, Role.BRAND)
  getProductDetails(
    @Req() req: ExpressRequest,
    @Param('slug') productSlug: string,
  ) {
    return this.productService.getProductDetails(
      // @ts-ignore
      req?.user?.id!,
      productSlug,
    );
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'thumbnail', maxCount: 1 }, // name must match frontend formData key
      { name: 'images', maxCount: 5 }, // name must match frontend formData key
    ]),
  )
  async create(
    @UploadedFiles()
    files: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Body() body: CreateProductDto,
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

    return this.productService.create(body, thumbnailFile, galleryFiles);
  }

  @Patch('/:id')
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

    return this.productService.update(
      id,
      body,
      newThumbnail,
      newGallery,
      existingThumbnail,
      existingImages,
    );
  }

  @Delete('/:id')
  @Roles(Role.USER, Role.CLIENT, Role.BRAND) // Or Role.BRAND depending on your setup
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.productService.remove(id, req.user.id);
  }

  @Get('public/all')
  @Public()
  async getPublicProducts(
    @Req() req: ExpressRequest,
    @Query('category') category: string,
    @Query('search') search: string,
  ) {
    // @ts-ignore
    return this.productService.getPublicProducts(req?.user?.id!, {
      category,
      search,
    });
  }

  @Get('public/details/:slug')
  @Public()
  async getPublicProductDetails(
    @Param('slug') slug: string,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    const userId = req?.user?.id;
    return this.productService.getPublicProductDetails(slug, userId);
  }

  @Get('public/related/:id')
  @Public()
  async getRelated(
    @Param('id') id: string,
    @Query('category') category: string,
  ) {
    return this.productService.getRelatedProducts(id, category);
  }
}
