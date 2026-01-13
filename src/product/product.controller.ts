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

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @Roles(Role.USER)
  getProducts(@Req() req: ExpressRequest) {
    return this.productService.getProducts(
      // @ts-ignore
      req?.user?.id!,
    );
  }

  @Get('/:slug')
  @Roles(Role.USER)
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
}
