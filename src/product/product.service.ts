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
import { notDeleted } from 'src/utils/prismaFilters';

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
      where: { brandId: brand.id, ...notDeleted() },
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
      where: { brandId: brand.id, slug: slug, ...notDeleted() },
    });

    if (!product) throw new NotFoundException('Oops! Product not found');

    return product;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    newThumbnail?: Express.Multer.File,
    newGallery: Express.Multer.File[] = [],
    existingThumbnail?: string,
    existingImages: string[] = [],
  ) {
    // 1. Check if product exists
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    // 2. Handle Thumbnail
    let finalThumbnail = existingThumbnail || product.thumbnail;
    if (newThumbnail) {
      const uploadResult = await this.uploadService.uploadProductImages(id, [
        newThumbnail,
      ]);
      finalThumbnail = uploadResult[0];
    }

    // 3. Handle Gallery Images (Merge existing URLs with newly uploaded files)
    let finalGallery = existingImages;
    if (newGallery.length > 0) {
      const newUploadedUrls = await this.uploadService.uploadProductImages(
        id,
        newGallery,
      );
      finalGallery = [...existingImages, ...newUploadedUrls];
    }

    // 4. Handle Slug (Only if name changed)
    let slug = product.slug;
    if (dto.name && dto.name !== product.name) {
      let baseSlug = slugify(dto.name, { lower: true });
      slug = baseSlug;
      let counter = 1;
      while (
        await this.prisma.product.findFirst({
          where: { slug, id: { not: id } },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // Helper for JSON parsing (same as your create method)
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

    // 5. Update in Database
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        brandId: dto.brandId,
        price: dto.price ? Number(dto.price) : undefined,
        compareAtPrice: dto.compareAtPrice ? Number(dto.compareAtPrice) : null,
        stock: dto.stock ? Number(dto.stock) : undefined,
        sku: dto.sku,
        status: dto.status,
        shortDescription: dto.shortDescription,
        description: dto.description,
        slug,
        thumbnail: finalThumbnail,
        images: finalGallery,
        sizes: dto.sizes ? safeParse(dto.sizes) : undefined,
        availableColors: dto.availableColors
          ? safeParse(dto.availableColors)
          : undefined,
      },
    });

    return { message: 'Product updated successfully', product: updatedProduct };
  }

  async remove(productId: string, userId: string) {
    // 1. Verify ownership (ensure this user owns the brand that owns this product)
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        brand: { userId: userId },
      },
    });

    if (!product)
      throw new NotFoundException('Product not found or unauthorized');

    // 2. Perform Soft Delete
    await this.prisma.product.update({
      where: { id: productId },
      data: { isDeleted: true },
    });

    return { message: 'Product moved to trash successfully' };
  }

  // product.service.ts

  async getPublicProducts(
    userId?: string,
    query?: { category?: string; search?: string },
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        ...notDeleted(),
        ...(query?.category && { category: query.category }),
        ...(query?.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        brand: {
          select: { brandName: true, brandLogo: true },
        },
        savedBy: userId ? { where: { userId: userId } } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform the data to include a simple boolean "isSaved"
    return products.map((product) => {
      const { savedBy, ...rest } = product;
      return {
        ...rest,
        isSaved: savedBy ? savedBy.length > 0 : false,
      };
    });
  }

  async getPublicProductDetails(slug: string, userId?: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug: slug,
        status: 'PUBLISHED',
        ...notDeleted(),
      },
      include: {
        brand: {
          select: {
            brandName: true,
            brandLogo: true,
            description: true,
          },
        },
        // Check if the current user has saved this specific product
        savedBy: userId ? { where: { userId: userId } } : false,
      },
    });

    if (!product) {
      throw new NotFoundException('Oops! Product not found');
    }

    // Transform to extract the isSaved boolean
    const { savedBy, ...rest } = product;

    return {
      ...rest,
      isSaved: savedBy ? savedBy.length > 0 : false,
    };
  }

  async getRelatedProducts(productId: string, category: string) {
    return this.prisma.product.findMany({
      where: {
        category: category,
        id: { not: productId }, // Don't show the current product
        status: 'PUBLISHED',
        ...notDeleted(),
      },
      take: 4, // Limit the number of related items
      include: {
        brand: {
          select: { brandName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
