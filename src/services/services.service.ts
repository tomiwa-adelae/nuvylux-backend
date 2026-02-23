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
import { DeliveryMode, ServiceType } from '@prisma/client';

export interface ExploreServicesQuery {
  type?: string;
  search?: string;
  deliveryMode?: string;
  priceMin?: string;
  priceMax?: string;
  city?: string;
  state?: string;
  lat?: string;
  lng?: string;
  radius?: string; // km
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'distance';
}

@Injectable()
export class ServicesService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Geo utilities
  // ────────────────────────────────────────────────────────────

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async geocodeLocation(
    location: string,
  ): Promise<{ lat: number; lng: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Nuvylux/1.0 (contact@nuvylux.com)',
          Accept: 'application/json',
        },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as Array<{
        lat: string;
        lon: string;
      }>;
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Create
  // ────────────────────────────────────────────────────────────

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

    // Geocode location for in-person / hybrid services (non-blocking)
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (
      dto.location &&
      (dto.deliveryMode === 'IN_PERSON' || dto.deliveryMode === 'HYBRID')
    ) {
      const coords = await this.geocodeLocation(dto.location);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

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
        latitude,
        longitude,
        pricingType: dto.pricingType,
        duration: dto.duration,
        deliveryTimeline: dto.deliveryTimeline,
        revisions: dto.revisions,
        cancellationPolicy: dto.cancellationPolicy,
        bookingRules: dto.bookingRules,
        professionalProfile: {
          connect: { id: user.professionalProfile.id },
        },
        thumbnail: thumbResult[0],
        images: galleryResults,
      },
    });

    return { message: 'Service successfully created', service };
  }

  // ────────────────────────────────────────────────────────────
  // Read (professional)
  // ────────────────────────────────────────────────────────────

  async findAllByProfessional(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const services = await this.prisma.service.findMany({
      where: {
        userId: userId,
        ...notDeleted(),
      },
      orderBy: {
        createdAt: 'desc',
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

  // ────────────────────────────────────────────────────────────
  // Update
  // ────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateServiceDto,
    newThumbnail?: Express.Multer.File,
    newGallery: Express.Multer.File[] = [],
    existingThumbnail?: string,
    existingImages: string[] = [],
  ) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');

    // Handle Thumbnail
    let finalThumbnail = existingThumbnail || service.thumbnail;
    if (newThumbnail) {
      const uploadResult = await this.uploadService.uploadServicesImages(id, [
        newThumbnail,
      ]);
      finalThumbnail = uploadResult[0];
    }

    // Handle Gallery Images
    let finalGallery = existingImages;
    if (newGallery.length > 0) {
      const newUploadedUrls = await this.uploadService.uploadServicesImages(
        id,
        newGallery,
      );
      finalGallery = [...existingImages, ...newUploadedUrls];
    }

    // Handle Slug
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

    // Re-geocode if location changed
    let latitude: number | null | undefined = undefined; // undefined = don't update
    let longitude: number | null | undefined = undefined;
    const locationChanged =
      dto.location !== undefined && dto.location !== service.location;
    const newLocation = dto.location ?? service.location;
    const newMode = dto.deliveryMode ?? service.deliveryMode;

    if (
      locationChanged &&
      newLocation &&
      (newMode === 'IN_PERSON' || newMode === 'HYBRID')
    ) {
      const coords = await this.geocodeLocation(newLocation);
      latitude = coords?.lat ?? null;
      longitude = coords?.lng ?? null;
    } else if (locationChanged && !newLocation) {
      // Location was cleared
      latitude = null;
      longitude = null;
    }

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
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        currency: dto.currency,
        pricingType: dto.pricingType,
        cancellationPolicy: dto.cancellationPolicy,
      },
    });

    return { message: 'Service updated successfully', service: updatedService };
  }

  // ────────────────────────────────────────────────────────────
  // Public explore with location filtering
  // ────────────────────────────────────────────────────────────

  async getPublicServices(userId?: string, query?: ExploreServicesQuery) {
    const userLat = query?.lat ? parseFloat(query.lat) : undefined;
    const userLng = query?.lng ? parseFloat(query.lng) : undefined;
    const radius = query?.radius ? parseFloat(query.radius) : undefined;

    // Build price filter
    const priceFilter: Record<string, number> = {};
    if (query?.priceMin) priceFilter.gte = parseFloat(query.priceMin);
    if (query?.priceMax) priceFilter.lte = parseFloat(query.priceMax);

    // Determine DB-level sort (distance sort happens in JS after fetch)
    const dbOrderBy =
      query?.sortBy === 'price_asc'
        ? { price: 'asc' as const }
        : query?.sortBy === 'price_desc'
          ? { price: 'desc' as const }
          : { createdAt: 'desc' as const };

    // Build location text filter (city/state matching)
    // Only applied when we don't have coordinates (to narrow results)
    const locationWhereClause =
      !userLat && (query?.city || query?.state)
        ? {
            OR: [
              ...(query.city
                ? [
                    {
                      user: {
                        city: { contains: query.city, mode: 'insensitive' as const },
                      },
                    },
                    {
                      location: {
                        contains: query.city,
                        mode: 'insensitive' as const,
                      },
                    },
                  ]
                : []),
              ...(query.state
                ? [
                    {
                      user: {
                        state: {
                          contains: query.state,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  ]
                : []),
            ],
          }
        : {};

    const services = await this.prisma.service.findMany({
      where: {
        status: 'ACTIVE',
        ...notDeleted(),
        ...(query?.type && { type: query.type as ServiceType }),
        ...(query?.deliveryMode && {
          deliveryMode: query.deliveryMode as DeliveryMode,
        }),
        ...(query?.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            {
              shortDescription: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
            { location: { contains: query.search, mode: 'insensitive' } },
            {
              professionalProfile: {
                profession: { contains: query.search, mode: 'insensitive' },
              },
            },
            {
              professionalProfile: {
                businessName: { contains: query.search, mode: 'insensitive' },
              },
            },
          ],
        }),
        ...(Object.keys(priceFilter).length > 0 && { price: priceFilter }),
        ...locationWhereClause,
      },
      include: {
        professionalProfile: {
          select: {
            id: true,
            profession: true,
            businessName: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                image: true,
                city: true,
                state: true,
                country: true,
              },
            },
          },
        },
        user: {
          select: { city: true, state: true, country: true },
        },
      },
      orderBy: dbOrderBy,
    });

    // Attach distance to every service
    let servicesWithDistance = services.map((service) => {
      let distance: number | null = null;

      if (userLat !== undefined && userLng !== undefined) {
        // Prefer service-level coordinates (IN_PERSON services)
        if (service.latitude !== null && service.longitude !== null) {
          distance = this.haversineDistance(
            userLat,
            userLng,
            service.latitude,
            service.longitude,
          );
        }
      }

      return { ...service, distance };
    });

    // Filter by radius when coordinates are available
    if (userLat !== undefined && userLng !== undefined && radius) {
      servicesWithDistance = servicesWithDistance.filter(
        (s) =>
          // Include services without coordinates (ONLINE) or within radius
          s.distance === null || s.distance <= radius,
      );
    }

    // Sort by distance if requested
    if (query?.sortBy === 'distance' && userLat !== undefined) {
      servicesWithDistance.sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1; // push no-coords to end
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    return servicesWithDistance;
  }

  // ────────────────────────────────────────────────────────────
  // Public service details
  // ────────────────────────────────────────────────────────────

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
              select: {
                firstName: true,
                lastName: true,
                image: true,
                city: true,
                state: true,
                country: true,
              },
            },
          },
        },
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
