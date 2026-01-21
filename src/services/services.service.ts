// src/services/services.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadService } from 'src/upload/upload.service';
import slugify from 'slugify';
import { notDeleted } from 'src/utils/prismaFilters';
import { CreateServiceDto } from './dto/create-service.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ServicesService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async create(
    userId: string,
    dto: CreateServiceDto,
    thumbnail: Express.Multer.File | any,
    gallery: Express.Multer.File[],
  ) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');
    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: 'professional' },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const serviceId = randomUUID();

    if (!thumbnail) throw new BadRequestException('Thumbnail is required');

    if (!gallery || gallery.length === 0)
      throw new BadRequestException('Gallery images are required');

    const thumbResult = await this.uploadService.uploadServicesImages(
      serviceId,
      [thumbnail],
    );
    const galleryResults = await this.uploadService.uploadServicesImages(
      serviceId,
      gallery,
    );

    let baseSlug = slugify(`${dto.name}`);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.service.findUnique({ where: { slug } })) {
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

    const service = await this.prisma.service.create({
      data: {
        id: serviceId,
        name: dto.name,
        userId: user?.id,
        price: Number(dto.price),
        status: dto.status,
        shortDescription: dto.shortDescription,
        description: dto.description,
        slug,
        type: dto.type,
        deliveryMode: dto.deliveryMode,
        currency: dto.currency,
        pricingType: dto.pricingType,
        deliveryTimeline: dto.deliveryTimeline,
        revisions: dto.revisions,
        cancellationPolicy: dto.cancellationPolicy,

        // Images
        thumbnail: thumbResult[0],
        images: galleryResults,
      },
    });

    return { message: 'Service successfully created', service };
  }

  async findAllByProfessional(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const services = await this.prisma.service.findMany({
      where: {
        userId: userId,
        ...notDeleted(), // Ensure we only get active/draft services
      },
      orderBy: {
        createdAt: 'desc', // Show newest first
      },
    });

    return services;
  }
}
