// order/order.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { notDeleted } from 'src/utils/prismaFilters';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  private async generateOrderNumber(): Promise<string> {
    const prefix = 'NUV';
    const year = new Date().getFullYear();

    // 1. Find the latest order to get the last sequence number
    const lastOrder = await this.prisma.order.findFirst({
      where: {
        orderNumber: {
          startsWith: `${prefix}-${year}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        orderNumber: true,
      },
    });

    let nextSequence = 1;

    if (lastOrder && lastOrder.orderNumber) {
      // 2. Extract the number from "NUV-2026-000001" -> "000001"
      const parts = lastOrder.orderNumber.split('-');
      const lastSequence = parseInt(parts[2], 10);
      nextSequence = lastSequence + 1;
    }

    // 3. Format to 6 digits (e.g., 000001)
    const paddedSequence = nextSequence.toString().padStart(6, '0');

    return `${prefix}-${year}-${paddedSequence}`;
  }

  async create(dto: CreateOrderDto, userId: string) {
    const {
      items,
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      customerNote,
      totalAmount,
    } = dto;

    if (!items.length) {
      throw new BadRequestException('Cart is empty');
    }

    /* --------------------------------
       1. Load products (deduplicated)
    -------------------------------- */
    const productIds = [...new Set(items.map((i) => i.productId))];

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isDeleted: false,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Some products no longer exist');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    /* --------------------------------
       2. Aggregate quantities per product
    -------------------------------- */
    const quantityMap = new Map<string, number>();

    for (const item of items) {
      quantityMap.set(
        item.productId,
        (quantityMap.get(item.productId) ?? 0) + item.quantity,
      );
    }

    /* --------------------------------
       3. Stock validation
    -------------------------------- */
    for (const [productId, qty] of quantityMap) {
      const product = productMap.get(productId)!;

      if (product.stock < qty) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}. Only ${product.stock} left.`,
        );
      }
    }

    /* --------------------------------
       4. Calculate totals (SERVER AUTHORITY)
    -------------------------------- */
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const deliveryFee = 15;
    const discount = 0;
    const total = subtotal + deliveryFee - discount;

    if (Math.abs(total - totalAmount) > 0.01) {
      throw new BadRequestException('Order total mismatch');
    }
    /* --------------------------------
       5. Transaction
    -------------------------------- */
    const order = await this.prisma.$transaction(async (tx) => {
      // Generate the sequential order number within the transaction
      const orderNumber = await this.generateOrderNumber();

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          subtotal,
          discount,
          deliveryFee,
          total,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          customerNote,
          shippingAddress: {
            create: {
              firstName,
              lastName,
              phone,
              address,
              city,
              state,
            },
          },
          items: {
            create: items.map((item) => {
              const product = productMap.get(item.productId)!;

              return {
                productId: product.id,
                productName: product.name,
                productSlug: product.slug,
                productImage: product.thumbnail || product.images?.[0] || '',
                quantity: item.quantity,
                price: item.price,
                size: item.size,
                color: item.color,
              };
            }),
          },
        },
        include: {
          items: true,
          shippingAddress: true,
        },
      });

      for (const [productId, qty] of quantityMap) {
        await tx.product.update({
          where: { id: productId },
          data: {
            stock: { decrement: qty },
          },
        });
      }

      return createdOrder;
    });

    return {
      message: 'Order created successfully',
      order,
    };
  }

  /* ---------- Queries ---------- */

  async findUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        shippingAddress: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        shippingAddress: true,
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findUserOrdersDetails(userId, orderNumber) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        shippingAddress: true,
      },
    });

    return order;
  }
}
