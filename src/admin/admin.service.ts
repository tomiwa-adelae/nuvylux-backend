import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminPosition } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';
import Mailjet from 'node-mailjet';
import { notDeleted } from 'src/utils/prismaFilters';
import { PasswordResetEmail } from 'emails/password-reset-email';

const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_PUBLIC_KEY!,
  process.env.MAILJET_API_PRIVATE_KEY!,
);

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── DASHBOARD ────────────────────────────────────────

  async getStats() {
    const [
      totalUsers,
      totalOrders,
      totalBookings,
      totalProducts,
      totalServices,
      paidOrders,
      paidBookings,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...notDeleted() } }),
      this.prisma.order.count(),
      this.prisma.serviceBooking.count(),
      this.prisma.product.count({ where: { ...notDeleted() } }),
      this.prisma.service.count({ where: { isDeleted: false } }),
      this.prisma.order.findMany({
        where: { paymentStatus: 'PAID' },
        select: { total: true },
      }),
      this.prisma.serviceBooking.findMany({
        where: { paymentStatus: 'PAID' },
        select: { totalAmount: true },
      }),
    ]);

    const orderRevenue = paidOrders.reduce(
      (sum, o) => sum + Number(o.total),
      0,
    );
    const bookingRevenue = paidBookings.reduce(
      (sum, b) => sum + Number(b.totalAmount),
      0,
    );

    // Recent activity
    const [recentOrders, recentBookings, recentUsers] = await Promise.all([
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, image: true } },
        },
      }),
      this.prisma.serviceBooking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { firstName: true, lastName: true, email: true, image: true } },
          service: { select: { name: true } },
        },
      }),
      this.prisma.user.findMany({
        take: 5,
        where: { ...notDeleted() },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          image: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalUsers,
      totalOrders,
      totalBookings,
      totalProducts,
      totalServices,
      totalRevenue: orderRevenue + bookingRevenue,
      orderRevenue,
      bookingRevenue,
      recentOrders,
      recentBookings,
      recentUsers,
    };
  }

  // ─── USERS ────────────────────────────────────────────

  async getUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { ...notDeleted() };

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          username: true,
          role: true,
          image: true,
          createdAt: true,
          onboardingCompleted: true,
          isDeleted: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        role: true,
        image: true,
        phoneNumber: true,
        city: true,
        state: true,
        country: true,
        gender: true,
        dob: true,
        createdAt: true,
        onboardingCompleted: true,
        isDeleted: true,
        _count: {
          select: {
            orders: true,
            bookings: true,
            services: true,
            brand: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Fetch recent activity data in parallel
    const [recentOrders, recentBookings, services, brands] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.serviceBooking.findMany({
        where: { clientId: userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          bookingNumber: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          service: { select: { name: true, thumbnail: true } },
        },
      }),
      this.prisma.service.findMany({
        where: { userId, isDeleted: false },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          thumbnail: true,
          price: true,
          status: true,
          type: true,
          _count: { select: { bookings: true } },
        },
      }),
      this.prisma.brand.findMany({
        where: { userId, ...notDeleted() },
        select: {
          id: true,
          brandName: true,
          brandLogo: true,
          brandType: true,
          _count: { select: { products: true } },
        },
      }),
    ]);

    return { ...user, recentOrders, recentBookings, services, brands };
  }

  async resetUserPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Generate a random temporary password
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Send email with new password
    await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.SENDER_EMAIL_ADDRESS,
            Name: 'Nuvylux',
          },
          To: [{ Email: user.email, Name: user.firstName }],
          Subject: 'Your Password Has Been Reset',
          HTMLPart: PasswordResetEmail({
            firstName: user.firstName,
            newPassword,
          }),
        },
      ],
    });

    return { message: 'Password reset successfully. New password sent to user email.' };
  }

  async updateUser(userId: string, data: { role?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMINISTRATOR')
      throw new ForbiddenException('Cannot delete admin users from here');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isDeleted: true },
    });

    return { message: 'User deactivated successfully' };
  }

  // ─── ORDERS ───────────────────────────────────────────

  async getOrders(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true, image: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOrderDetails(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            phoneNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnail: true,
                slug: true,
                brand: {
                  select: {
                    id: true,
                    brandName: true,
                    brandLogo: true,
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        shippingAddress: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrderStatus(orderNumber: string, status: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.order.update({
      where: { orderNumber },
      data: { status: status as any },
    });
  }

  // ─── BOOKINGS ─────────────────────────────────────────

  async getBookings(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { bookingNumber: { contains: query.search, mode: 'insensitive' } },
        {
          client: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
        {
          service: {
            name: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [bookings, total] = await Promise.all([
      this.prisma.serviceBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { firstName: true, lastName: true, email: true, image: true },
          },
          service: {
            select: { name: true, thumbnail: true },
          },
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.serviceBooking.count({ where }),
    ]);

    return {
      bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBookingDetails(bookingNumber: string) {
    const booking = await this.prisma.serviceBooking.findUnique({
      where: { bookingNumber },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            phoneNumber: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            thumbnail: true,
            price: true,
            type: true,
            deliveryMode: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async updateBookingStatus(bookingNumber: string, status: string) {
    const booking = await this.prisma.serviceBooking.findUnique({
      where: { bookingNumber },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.serviceBooking.update({
      where: { bookingNumber },
      data: { status: status as any },
    });
  }

  // ─── PRODUCTS ─────────────────────────────────────────

  async getProducts(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { ...notDeleted() };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: {
            select: { brandName: true, brandLogo: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateProductStatus(productId: string, status: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.product.update({
      where: { id: productId },
      data: { status: status as any },
    });
  }

  async getProductDetails(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: {
          select: {
            id: true,
            brandName: true,
            brandLogo: true,
            brandType: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: { select: { orderItems: true, savedBy: true } },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async deleteProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({
      where: { id: productId },
      data: { isDeleted: true },
    });

    return { message: 'Product deleted successfully' };
  }

  // ─── SERVICES ─────────────────────────────────────────

  async getServices(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { isDeleted: false };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { firstName: true, lastName: true, image: true },
          },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      services,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateServiceStatus(serviceId: string, status: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { status: status as any },
    });
  }

  async getServiceDetails(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
        professionalProfile: {
          select: {
            profession: true,
            businessName: true,
          },
        },
        _count: { select: { bookings: true } },
      },
    });

    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async deleteService(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    await this.prisma.service.update({
      where: { id: serviceId },
      data: { isDeleted: true },
    });

    return { message: 'Service deleted successfully' };
  }

  // ─── ADMIN TEAM ───────────────────────────────────────

  async getAdmins() {
    return this.prisma.admin.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdmin(dto: CreateAdminDto, requestingAdminUserId: string) {
    // Verify requesting user is SUPER_ADMIN
    await this.requireSuperAdmin(requestingAdminUserId);

    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('A user with this email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let baseUsername = slugify(`${dto.firstName} ${dto.lastName}`);
    let username = baseUsername;
    let counter = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}-${counter}`;
      counter++;
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        username,
        role: 'ADMINISTRATOR',
        onboardingCompleted: true,
        emailVerified: true,
      },
    });

    const admin = await this.prisma.admin.create({
      data: {
        userId: user.id,
        position: dto.position,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return admin;
  }

  async updateAdminPosition(
    adminId: string,
    position: AdminPosition,
    requestingAdminUserId: string,
  ) {
    await this.requireSuperAdmin(requestingAdminUserId);

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');

    return this.prisma.admin.update({
      where: { id: adminId },
      data: { position },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async removeAdmin(adminId: string, requestingAdminUserId: string) {
    await this.requireSuperAdmin(requestingAdminUserId);

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      include: { user: true },
    });
    if (!admin) throw new NotFoundException('Admin not found');

    if (admin.userId === requestingAdminUserId) {
      throw new ForbiddenException('You cannot remove yourself as admin');
    }

    // Delete admin record and revert user role
    await this.prisma.$transaction([
      this.prisma.admin.delete({ where: { id: adminId } }),
      this.prisma.user.update({
        where: { id: admin.userId },
        data: { role: 'USER' },
      }),
    ]);

    return { message: 'Admin privileges removed successfully' };
  }

  // ─── HELPERS ──────────────────────────────────────────

  private async requireSuperAdmin(userId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
    });

    if (!admin || admin.position !== AdminPosition.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admins can perform this action',
      );
    }
  }
}
