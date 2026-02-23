import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  image: true,
};

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildDistribution(reviews: { rating: number }[]) {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) dist[r.rating] = (dist[r.rating] ?? 0) + 1;
    return dist;
  }

  private buildSummary(reviews: any[]) {
    const totalCount = reviews.length;
    const averageRating =
      totalCount > 0
        ? Math.round(
            (reviews.reduce((s, r) => s + r.rating, 0) / totalCount) * 10,
          ) / 10
        : 0;
    return { reviews, averageRating, totalCount, distribution: this.buildDistribution(reviews) };
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateReviewDto, userId: string) {
    const { rating, comment, productId, serviceId } = dto;

    if ((!productId && !serviceId) || (productId && serviceId)) {
      throw new BadRequestException(
        'Provide exactly one of productId or serviceId',
      );
    }

    if (productId) {
      // Verify: user has a DELIVERED order item for this product
      const delivered = await this.prisma.orderItem.findFirst({
        where: {
          productId,
          status: 'DELIVERED',
          order: { userId },
        },
      });
      if (!delivered) {
        throw new ForbiddenException(
          'You must receive this product before leaving a review',
        );
      }

      // Check for any existing review — including soft-deleted ones,
      // because the DB unique constraint spans all rows regardless of isDeleted.
      const existing = await this.prisma.review.findFirst({
        where: { userId, productId },
      });
      if (existing) {
        if (existing.isDeleted) {
          // Restore the soft-deleted review with fresh data
          return this.prisma.review.update({
            where: { id: existing.id },
            data: { rating, comment, isDeleted: false },
            include: { user: { select: USER_SELECT } },
          });
        }
        throw new BadRequestException(
          'You have already reviewed this product',
        );
      }
    }

    if (serviceId) {
      // Verify: user has a COMPLETED booking as the client
      const completed = await this.prisma.serviceBooking.findFirst({
        where: {
          serviceId,
          clientId: userId,
          status: 'COMPLETED',
        },
      });
      if (!completed) {
        throw new ForbiddenException(
          'You must complete a booking for this service before leaving a review',
        );
      }

      const existing = await this.prisma.review.findFirst({
        where: { userId, serviceId },
      });
      if (existing) {
        if (existing.isDeleted) {
          return this.prisma.review.update({
            where: { id: existing.id },
            data: { rating, comment, isDeleted: false },
            include: { user: { select: USER_SELECT } },
          });
        }
        throw new BadRequestException(
          'You have already reviewed this service',
        );
      }
    }

    const review = await this.prisma.review.create({
      data: { rating, comment, userId, productId, serviceId },
      include: { user: { select: USER_SELECT } },
    });

    return review;
  }

  // ─── Find for Product ─────────────────────────────────────────────────────

  async findForProduct(productId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { productId, isDeleted: false },
      include: { user: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return this.buildSummary(reviews);
  }

  // ─── Find for Service ─────────────────────────────────────────────────────

  async findForService(serviceId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { serviceId, isDeleted: false },
      include: { user: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return this.buildSummary(reviews);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateReviewDto, userId: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review || review.isDeleted) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Not your review');

    return this.prisma.review.update({
      where: { id },
      data: { ...dto },
      include: { user: { select: USER_SELECT } },
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, userId: string, isAdmin: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review || review.isDeleted) throw new NotFoundException('Review not found');
    if (!isAdmin && review.userId !== userId) {
      throw new ForbiddenException('Not your review');
    }

    return this.prisma.review.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  // ─── Admin: all reviews ───────────────────────────────────────────────────

  async findAll() {
    return this.prisma.review.findMany({
      where: { isDeleted: false },
      include: {
        user: { select: USER_SELECT },
        product: { select: { id: true, name: true, slug: true, thumbnail: true } },
        service: { select: { id: true, name: true, slug: true, thumbnail: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
