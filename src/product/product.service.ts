import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadService } from 'src/upload/upload.service';
import { randomUUID } from 'crypto';
import slugify from 'slugify';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async create(
    dto: CreateProductDto,
    thumbnail: Express.Multer.File | any,
    gallery: Express.Multer.File[],
  ) {
    const productId = randomUUID();

    if (!thumbnail) throw new BadRequestException('Thumbnail is required');
    if (!gallery || gallery.length === 0)
      throw new BadRequestException('Gallery images are required');

    const thumbResult = await this.uploadService.uploadProductImages(
      productId,
      [thumbnail],
    );
    const galleryResults = await this.uploadService.uploadProductImages(
      productId,
      gallery,
    );

    let baseSlug = slugify(`${dto.name}`);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.product.findUnique({ where: { slug } })) {
      // Append a number if username exists
      slug = `${baseSlug}-${1}`;
      counter++;
    }

    // Helper to safely parse JSON strings from FormData
    const safeParse = (data: any) => {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch {
          return [];
        }
      }
      return data || [];
    };

    const product = await this.prisma.product.create({
      data: {
        id: productId,
        name: dto.name,
        category: dto.category,
        brandId: dto.brandId,
        price: Number(dto.price),
        compareAtPrice: dto.compareAtPrice ? Number(dto.compareAtPrice) : null,
        stock: Number(dto.stock),
        sku: dto.sku,
        status: dto.status,
        shortDescription: dto.shortDescription,
        description: dto.description,
        slug,

        // Images
        thumbnail: thumbResult[0],
        images: galleryResults,

        // Arrays
        sizes: safeParse(dto.sizes),
        availableColors: safeParse(dto.availableColors),
      },
    });

    return { message: 'Product successfully created', product };
  }

  async getProducts(userId: string) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: 'brand' },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const brand = await this.prisma.brand.findUnique({
      where: { userId: user.id },
    });

    if (!brand) throw new NotFoundException('Oops! Brand not found');

    const products = await this.prisma.product.findMany({
      where: { brandId: brand.id },
    });

    return products;
  }

  async getProductDetails(userId: string, slug: string) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: 'brand' },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const brand = await this.prisma.brand.findUnique({
      where: { userId: user.id },
    });

    if (!brand) throw new NotFoundException('Oops! Brand not found');

    const product = await this.prisma.product.findUnique({
      where: { brandId: brand.id, slug: slug },
    });

    if (!product) throw new NotFoundException('Oops! Product not found');

    return product;
  }
}
