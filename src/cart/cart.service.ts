import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCartDto } from './dto/create-cart.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async upsertItem(userId: string, dto: CreateCartDto) {
    // Upsert handles: if user adds same product+variation, update quantity. Else, create.
    return this.prisma.cartItem.upsert({
      where: {
        userId_productId_size_color: {
          userId,
          productId: dto.productId,
          size: dto.size || '', // Prisma unique constraints prefer non-null
          color: dto.color || '',
        },
      },
      update: {
        quantity: { increment: dto.quantity },
      },
      create: {
        userId,
        productId: dto.productId,
        quantity: dto.quantity,
        size: dto.size || '',
        color: dto.color || '',
      },
    });
  }

  async getUserCart(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            name: true,
            price: true,
            thumbnail: true,
            slug: true,
          },
        },
      },
    });
  }

  async updateQuantity(userId: string, itemId: string, quantity: number) {
    return this.prisma.cartItem.updateMany({
      where: { id: itemId, userId },
      data: { quantity },
    });
  }

  async removeItem(userId: string, itemId: string) {
    const parts = itemId.split('-');

    if (parts.length > 5) {
      const productId = parts.slice(0, 5).join('-');
      const size = parts[5] || '';
      const color = parts[6] || '';

      const result = await this.prisma.cartItem.deleteMany({
        where: {
          userId,
          productId,
          size,
          color,
        },
      });

      return { message: 'Removed successfully', deleted: result.count };
    }

    const result = await this.prisma.cartItem.deleteMany({
      where: {
        id: itemId,
        userId,
      },
    });

    return { message: 'Removed successfully', deleted: result.count };
  }
}
