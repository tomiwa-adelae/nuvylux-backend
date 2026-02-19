// order/order.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItemStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { notDeleted } from 'src/utils/prismaFilters';
const Flutterwave = require('flutterwave-node-v3');

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  private flw = new Flutterwave(
    process.env.FW_PUBLIC_KEY,
    process.env.FW_SECRET_KEY,
  );

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
      where: { orderNumber, userId: user?.id },
      include: {
        items: true,
        shippingAddress: true,
        user: true,
      },
    });

    return order;
  }

  async cancelOrder(orderId: string, userId: string) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    // 2. Security & Validation
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    // Prevent cancellation if already shipped, delivered, or cancelled
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (
      order.shippedAt ||
      order.status === OrderStatus.SHIPPED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Cannot cancel an order that has already been shipped or delivered',
      );
    }

    // 3. Transaction: Update Order + Restock Products
    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // 4. Return stock to products
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
        });
      }

      return {
        message: 'Order cancelled successfully and stock restocked',
        order: updatedOrder,
      };
    });
  }

  async initializePayment(orderNumber: string, userId: string) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const order = await this.findUserOrdersDetails(userId, orderNumber);

    if (!order) throw new NotFoundException('Order not found');

    if (order.status === 'CANCELLED')
      throw new BadRequestException('Cannot pay for a cancelled order');

    if (order.paidAt) throw new BadRequestException('Order is already paid');

    const paymentData = {
      tx_ref: order.orderNumber, // Use orderNumber as reference
      amount: order.total.toString(),
      currency: 'NGN',
      redirect_url: `${process.env.FRONTEND_URL}/orders/${order.orderNumber}?payment=success`,
      customer: {
        email: order.user?.email || 'customer@email.com', // Ensure your query includes user email
        phonenumber: order?.shippingAddress?.phone,
        name: `${order?.shippingAddress?.firstName} ${order?.shippingAddress?.lastName}`,
      },
      customizations: {
        title: 'NUVYLUX Store',
        description: `Payment for Order #${order.orderNumber}`,
        // logo: 'https://your-logo-url.com/logo.png',
      },
    };

    try {
      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.FW_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (data.status === 'success') {
        return data; // This will contain the 'link' property
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      throw new BadRequestException('Payment gateway communication failed');
    }
  }

  async verifyTransaction(txRef: string, transactionId: string) {
    try {
      const response = await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.FW_SECRET_KEY}`,
          },
        },
      );

      const result = await response.json();

      // 2. Check if payment is successful and amounts match
      if (
        result.status === 'success' &&
        result.data.status === 'successful' &&
        result.data.tx_ref === txRef
      ) {
        // 3. Update Order in Database
        return await this.prisma.order.update({
          where: { orderNumber: txRef },
          data: {
            paymentStatus: 'PAID',
            paidAt: new Date(),
            status: 'PROCESSING', // Move from PENDING to PROCESSING
            transactionRef: transactionId,
          },
        });
      }

      // throw new Error('Transaction verification failed');
    } catch (error) {
      console.error('Verification Error:', error);
      throw error;
    }
  }

  async findBrandOrders(userId: string) {
    if (!userId) throw new NotFoundException();

    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: 'BRAND' },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const brand = await this.prisma.brand.findUnique({
      where: { userId: user.id },
    });

    if (!brand) throw new NotFoundException('Oops! Brand not found');

    const orders = await this.prisma.order.findMany({
      where: {
        items: {
          some: {
            product: { brandId: brand.id },
          },
        },
      },
      include: {
        items: {
          where: {
            product: { brandId: brand.id },
          },
        },
        shippingAddress: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate brand-specific earnings for each order in the list
    return orders.map((order) => {
      const brandEarnings = order.items.reduce(
        (acc, item) => acc + Number(item.price) * item.quantity,
        0,
      );

      return {
        ...order,
        brandEarnings, // Add this field for the frontend list view
      };
    });
  }

  async findBrandOrderDetails(userId: string, orderNumber: string) {
    // 1. Verify User and get their Brand ID
    const brand = await this.prisma.brand.findUnique({
      where: { userId },
    });

    if (!brand) {
      throw new NotFoundException('Brand profile not found for this user.');
    }

    // 2. Find the order but filter the items by brandId
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        shippingAddress: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        // Here is the magic: Filter items at the database level
        items: {
          where: {
            product: {
              brandId: brand.id,
            },
          },
        },
      },
    });

    if (!order || order.items.length === 0) {
      throw new NotFoundException(
        'Order not found or contains no items from your brand.',
      );
    }

    // 3. Optional: Calculate Brand-Specific Subtotal
    // This is useful if the brand wants to see only what THEY earned from this order
    const brandSubtotal = order.items.reduce(
      (acc, item) => acc + Number(item.price) * item.quantity,
      0,
    );

    return {
      ...order,
      brandSubtotal,
    };
  }

  async updateBrandItemStatus(
    userId: string,
    orderId: string,
    newStatus: OrderItemStatus,
  ) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: 'BRAND' },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    // 1. Find the brand associated with the user
    const brand = await this.prisma.brand.findUnique({
      where: { userId: user?.id },
    });

    if (!brand) throw new NotFoundException('Brand profile not found');

    // 2. Update all items in this order that belong to this brand
    await this.prisma.orderItem.updateMany({
      where: {
        orderId: orderId,
        product: { brandId: brand.id },
      },
      data: {
        status: newStatus,
        ...(newStatus === 'SHIPPED' ? { shippedAt: new Date() } : {}),
        ...(newStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    });

    // 3. LOGIC: Determine Global Order Status
    const allItems = await this.prisma.orderItem.findMany({
      where: { orderId },
    });

    const totalItems = allItems.length;
    const shippedItems = allItems.filter(
      (i) => i.status === 'SHIPPED' || i.status === 'DELIVERED',
    ).length;
    const deliveredItems = allItems.filter(
      (i) => i.status === 'DELIVERED',
    ).length;

    let globalStatus: OrderStatus = OrderStatus.PROCESSING;

    if (deliveredItems === totalItems) {
      globalStatus = OrderStatus.DELIVERED;
    } else if (shippedItems === totalItems) {
      globalStatus = OrderStatus.SHIPPED;
    } else if (shippedItems > 0 || deliveredItems > 0) {
      // You might need to add PARTIALLY_SHIPPED to your OrderStatus enum in Prisma
      globalStatus = OrderStatus.SHIPPED;
    }

    // 4. Update the parent order
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: globalStatus,
        ...(globalStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(globalStatus === 'SHIPPED' && !shippedItems
          ? { shippedAt: new Date() }
          : {}),
      },
    });
  }
}
