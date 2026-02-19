import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadService } from 'src/upload/upload.service';
import { randomUUID } from 'crypto';
import Mailjet from 'node-mailjet';
import { BookingStatusEmail } from 'emails/booking-status-email';

const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_PUBLIC_KEY!,
  process.env.MAILJET_API_PRIVATE_KEY!,
);

@Injectable()
export class BookService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  private async sendBookingEmail({
    toEmail,
    toName,
    subject,
    recipientName,
    bookingNumber,
    serviceName,
    newStatus,
    message,
    ctaText,
    ctaUrl,
  }: {
    toEmail: string;
    toName: string;
    subject: string;
    recipientName: string;
    bookingNumber: string;
    serviceName: string;
    newStatus: string;
    message: string;
    ctaText?: string;
    ctaUrl?: string;
  }) {
    try {
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: process.env.SENDER_EMAIL_ADDRESS,
              Name: 'Nuvylux',
            },
            To: [{ Email: toEmail, Name: toName }],
            Subject: subject,
            HTMLPart: BookingStatusEmail({
              recipientName,
              bookingNumber,
              serviceName,
              newStatus,
              message,
              ctaText,
              ctaUrl,
            }),
          },
        ],
      });
    } catch (error) {
      console.error('Failed to send booking email:', error);
    }
  }

  async create(
    dto: CreateBookDto,
    files: Express.Multer.File[],
    userId: string,
  ) {
    // 1. Initial Validation
    if (!userId) throw new NotFoundException('User ID not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('Oops! User not found');

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service)
      throw new NotFoundException(
        'The service you are trying to book does not exist',
      );

    // 2. Generate a temporary ID for file pathing before the DB record exists
    const tempFolderId = randomUUID();

    // 3. Server-side Pricing Authority
    const price = Number(service.price);
    const serviceFee = price * 0.05; // 5% platform fee
    const totalAmount = price + serviceFee;

    // 4. Handle File Uploads (Cloudflare/S3)
    let attachmentUrls: string[] = [];
    if (files && files.length > 0) {
      attachmentUrls = await this.uploadService.uploadServiceBookingImages(
        tempFolderId,
        files,
      );
    }

    // 5. Date Parsing
    const scheduledAt = dto.date
      ? new Date(`${dto.date}T${dto.time}:00`)
      : null;

    /* --------------------------------
       6. Transactional Database Write
    -------------------------------- */
    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        // Generate sequential booking number (e.g., BK-2026-XXXX)
        const bookingNumber = await this.generateBookingNumber(tx);

        const createdBooking = await tx.serviceBooking.create({
          data: {
            bookingNumber,
            userId: user?.id,
            clientId: userId, // The person paying
            serviceId: dto.serviceId,
            requirements: dto.requirements,
            attachments: attachmentUrls,
            scheduledAt,
            price,
            serviceFee,
            totalAmount,
            status: 'PENDING',
            paymentStatus: 'PENDING',
          },
          include: {
            service: {
              select: { name: true, thumbnail: true },
            },
          },
        });

        return createdBooking;
      });

      return {
        message: 'Booking initiated successfully',
        booking,
      };
    } catch (error) {
      console.error('Booking Transaction Error:', error);
      throw new BadRequestException(
        'Failed to create booking. Please try again.',
      );
    }
  }

  async initializePayment(bookingId: string, userId: string) {
    if (!userId) throw new NotFoundException();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('Oops! User not found');

    const booking = await this.prisma.serviceBooking.findUnique({
      where: { id: bookingId },
      include: { service: true },
    });

    if (!booking || booking.clientId !== userId) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentStatus === 'PAID') {
      throw new BadRequestException('Booking already paid');
    }

    const paymentData = {
      tx_ref: booking.bookingNumber, // Unique reference
      amount: booking.totalAmount.toString(),
      currency: 'NGN',
      redirect_url: `${process.env.FRONTEND_URL}/bookings/${booking.id}/success`,
      customer: {
        email: user.email,
        phonenumber: user.phoneNumber || '',
        name: `${user.firstName} ${user.lastName}`,
      },
      customizations: {
        title: 'NUVYLUX Service Booking',
        description: `Payment for ${booking.service.name}`,
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
        return data; // returns the { link: '...' }
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
        return await this.prisma.serviceBooking.update({
          where: { bookingNumber: txRef },
          data: {
            paymentStatus: 'PAID',
            paidAt: new Date(),
            status: 'CONFIRMED', // Move from PENDING to PROCESSING
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

  private async generateBookingNumber(tx: any): Promise<string> {
    const lastBooking = await tx.serviceBooking.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { bookingNumber: true },
    });

    const lastId = lastBooking?.bookingNumber?.split('-')[1] || '0';
    const newId = (parseInt(lastId) + 1).toString().padStart(5, '0');
    return `BK-${newId}`;
  }

  async findAllByUser(userId: string) {
    if (!userId) throw new NotFoundException();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('Oops! User not found');

    return this.prisma.serviceBooking.findMany({
      where: { clientId: userId },
      include: {
        service: {
          select: {
            name: true,
            thumbnail: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(bookingNumber: string, userId: string) {
    if (!userId) throw new NotFoundException();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('Oops! User not found');

    const booking = await this.prisma.serviceBooking.findUnique({
      where: { bookingNumber },
      include: {
        service: true, // Includes all service details like description, images
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    // Security check: ensure the user owns this booking
    if (booking.clientId !== userId) {
      throw new BadRequestException(
        'You do not have permission to view this booking',
      );
    }

    return booking;
  }

  async cancelClientBooking(bookingNumber: string, userId: string) {
    if (!userId) throw new NotFoundException();

    const booking = await this.prisma.serviceBooking.findUnique({
      where: { bookingNumber },
      include: {
        service: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.clientId !== userId) {
      throw new BadRequestException(
        'You do not have permission to cancel this booking',
      );
    }

    if (booking.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === 'IN_PROGRESS') {
      throw new BadRequestException(
        'Cannot cancel a booking that is already in progress. Please contact support.',
      );
    }

    const updateData: any = {
      status: 'CANCELLED',
    };

    // If client already paid, mark for refund
    if (booking.paymentStatus === 'PAID') {
      updateData.paymentStatus = 'REFUNDED';
    }

    const updated = await this.prisma.serviceBooking.update({
      where: { bookingNumber },
      data: updateData,
      include: {
        service: true,
      },
    });

    // Fetch client name for email context
    const client = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const clientName = client
      ? `${client.firstName} ${client.lastName}`
      : 'A client';

    // Email the service provider about the cancellation
    const provider = booking.service.user;
    if (provider) {
      this.sendBookingEmail({
        toEmail: provider.email,
        toName: provider.firstName,
        subject: `Booking ${bookingNumber} has been cancelled by the client`,
        recipientName: provider.firstName,
        bookingNumber,
        serviceName: booking.service.name,
        newStatus: 'CANCELLED',
        message: `${clientName} has cancelled their booking for <strong>${booking.service.name}</strong>.${booking.paymentStatus === 'PAID' ? ' The client had already paid and a refund has been initiated.' : ''}`,
        ctaText: 'View Bookings',
        ctaUrl: `${process.env.FRONTEND_URL}/dashboard/bookings`,
      });
    }

    return updated;
  }

  async findProviderBookingDetails(providerId: string, bookingNumber: string) {
    if (!providerId) throw new NotFoundException();

    const booking = await this.prisma.serviceBooking.findUnique({
      where: { bookingNumber },
      include: {
        service: true,
        client: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.service.userId !== providerId) {
      throw new BadRequestException(
        'You do not have permission to view this booking',
      );
    }

    return booking;
  }

  async updateBookingStatus(
    providerId: string,
    bookingNumber: string,
    newStatus: string,
  ) {
    const booking = await this.findProviderBookingDetails(
      providerId,
      bookingNumber,
    );

    const current = booking.status;

    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    };

    const allowed = validTransitions[current];

    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${newStatus}`,
      );
    }

    // If provider cancels a paid booking, mark for refund
    const updateData: any = { status: newStatus };
    if (newStatus === 'CANCELLED' && booking.paymentStatus === 'PAID') {
      updateData.paymentStatus = 'REFUNDED';
    }

    const updated = await this.prisma.serviceBooking.update({
      where: { bookingNumber },
      data: updateData,
      include: {
        service: true,
        client: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            phoneNumber: true,
          },
        },
      },
    });

    // Fetch provider name for email context
    const provider = await this.prisma.user.findUnique({
      where: { id: providerId },
      select: { firstName: true, lastName: true },
    });

    const providerName = provider
      ? `${provider.firstName} ${provider.lastName}`
      : 'Your service provider';

    // Email the client about the status change
    const clientMessages: Record<string, { subject: string; message: string; ctaText?: string }> = {
      CONFIRMED: {
        subject: `Your booking ${bookingNumber} has been accepted`,
        message: `Great news! ${providerName} has accepted your booking for <strong>${updated.service.name}</strong>. Your service is now confirmed and the provider will begin working on it soon.`,
        ctaText: 'View Booking',
      },
      IN_PROGRESS: {
        subject: `Your service is now in progress — ${bookingNumber}`,
        message: `${providerName} has started working on your booking for <strong>${updated.service.name}</strong>. You will be notified when the service is complete.`,
        ctaText: 'View Booking',
      },
      COMPLETED: {
        subject: `Your service is complete — ${bookingNumber}`,
        message: `${providerName} has marked your booking for <strong>${updated.service.name}</strong> as completed. We hope you had a great experience!`,
        ctaText: 'View Booking',
      },
      CANCELLED: {
        subject: `Your booking ${bookingNumber} has been cancelled`,
        message: `Unfortunately, ${providerName} has cancelled your booking for <strong>${updated.service.name}</strong>. If you have already made a payment, a refund will be processed.`,
        ctaText: 'View Booking',
      },
    };

    const emailConfig = clientMessages[newStatus];
    if (emailConfig && updated.client) {
      this.sendBookingEmail({
        toEmail: updated.client.email,
        toName: updated.client.firstName,
        subject: emailConfig.subject,
        recipientName: updated.client.firstName,
        bookingNumber,
        serviceName: updated.service.name,
        newStatus,
        message: emailConfig.message,
        ctaText: emailConfig.ctaText,
        ctaUrl: `${process.env.FRONTEND_URL}/bookings/${updated.bookingNumber}`,
      });
    }

    return updated;
  }

  async findProviderBookings(providerId: string) {
    if (!providerId) throw new NotFoundException();

    const user = await this.prisma.user.findUnique({
      where: { id: providerId },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    return this.prisma.serviceBooking.findMany({
      where: {
        service: {
          userId: providerId, // Assuming 'userId' in Service table is the creator/provider
        },
      },
      include: {
        service: true,
        client: {
          // The person who booked
          select: {
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
