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
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceType } from '@prisma/client';

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
      where: { id: userId, role: 'PROFESSIONAL' },
      include: { professionalProfile: true },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    if (!user.professionalProfile) {
      throw new BadRequestException(
        'User does not have a professional profile. Please complete your profile first.',
      );
    }

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
        user: {
          connect: { id: user.id },
        },
        price: Number(dto.price),
        status: dto.status,
        shortDescription: dto.shortDescription,
        description: dto.description,
        slug,
        type: dto.type,
        deliveryMode: dto.deliveryMode,
        currency: dto.currency,
        location: dto.location,
        pricingType: dto.pricingType,
        duration: dto.duration,
        deliveryTimeline: dto.deliveryTimeline,
        revisions: dto.revisions,
        cancellationPolicy: dto.cancellationPolicy,
        bookingRules: dto.bookingRules,
        professionalProfile: {
          // Now this is safe because we checked above
          connect: { id: user.professionalProfile.id },
        },
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

  async getServiceDetails(userId: string, slug: string) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: 'PROFESSIONAL' },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const service = await this.prisma.service.findUnique({
      where: { userId: user?.id, slug: slug, ...notDeleted() },
    });

    if (!service) throw new NotFoundException('Oops! Service not found');

    return service;
  }

  async update(
    id: string,
    dto: UpdateServiceDto,
    newThumbnail?: Express.Multer.File,
    newGallery: Express.Multer.File[] = [],
    existingThumbnail?: string,
    existingImages: string[] = [],
  ) {
    // 1. Check if product exists
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');

    // 2. Handle Thumbnail
    let finalThumbnail = existingThumbnail || service.thumbnail;
    if (newThumbnail) {
      const uploadResult = await this.uploadService.uploadServicesImages(id, [
        newThumbnail,
      ]);
      finalThumbnail = uploadResult[0];
    }

    // 3. Handle Gallery Images (Merge existing URLs with newly uploaded files)
    let finalGallery = existingImages;
    if (newGallery.length > 0) {
      const newUploadedUrls = await this.uploadService.uploadServicesImages(
        id,
        newGallery,
      );
      finalGallery = [...existingImages, ...newUploadedUrls];
    }

    // 4. Handle Slug (Only if name changed)
    let slug = service.slug;
    if (dto.name && dto.name !== service.name) {
      let baseSlug = slugify(dto.name, { lower: true });
      slug = baseSlug;
      let counter = 1;
      while (
        await this.prisma.service.findFirst({
          where: { slug, id: { not: id } },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // 5. Update in Database
    const updatedService = await this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name,
        price: dto.price ? Number(dto.price) : undefined,
        revisions: dto.revisions ? Number(dto.revisions) : undefined,
        duration: dto.duration ? Number(dto.duration) : undefined,
        status: dto.status,
        shortDescription: dto.shortDescription,
        description: dto.description,
        slug,
        thumbnail: finalThumbnail,
        images: finalGallery,
        type: dto.type,
        deliveryMode: dto.deliveryMode,
        location: dto.location,
        currency: dto.currency,
        pricingType: dto.pricingType,
        cancellationPolicy: dto.cancellationPolicy,
      },
    });

    return { message: 'Service updated successfully', service: updatedService };
  }

  async getPublicServices(
    userId?: string,
    query?: { type?: string; search?: string },
  ) {
    const services = await this.prisma.service.findMany({
      where: {
        status: 'ACTIVE', // Only show live services to clients
        ...notDeleted(),
        ...(query?.type && { type: query.type as ServiceType }),
        ...(query?.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            {
              shortDescription: { contains: query.search, mode: 'insensitive' },
            },
          ],
        }),
      },
      include: {
        // Essential for the Service Card UI
        professionalProfile: {
          select: {
            id: true,
            profession: true,
            user: { select: { firstName: true, lastName: true, image: true } },
          },
        },
        // If you have a "SavedServices" table similar to products
        // savedBy: userId ? { where: { userId: userId } } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return services.map((service) => ({
      ...service,
      // isSaved: service.savedBy ? service.savedBy.length > 0 : false,
    }));
  }

  async getPublicServiceDetails(slug: string, userId?: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        slug: slug,
        status: 'ACTIVE',
        ...notDeleted(),
      },
      include: {
        professionalProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true, image: true },
            },
          },
        },
        // Include other services by this same professional for the "More from" section
        user: {
          include: {
            services: {
              where: {
                slug: { not: slug },
                status: 'ACTIVE',
              },
              take: 3,
            },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Oops! Service not found');
    }

    return service;
  }
}
