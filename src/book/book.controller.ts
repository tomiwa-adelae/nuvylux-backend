import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
  Query,
} from '@nestjs/common';
import { BookService } from './book.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response, Request as ExpressRequest } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookController {
  constructor(private readonly bookService: BookService) {}

  @Post('create')
  @Roles(Role.USER, Role.CLIENT)
  @UseInterceptors(FilesInterceptor('images')) // 'images' must match the key in your frontend FormData
  async create(
    @Body() createBookDto: CreateBookDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.bookService.create(createBookDto, files, req.user.id);
  }

  @Post(':bookingId/pay')
  @Roles(Role.USER, Role.CLIENT)
  initializePayment(
    @Param('bookingId') bookingId: string,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.bookService.initializePayment(bookingId, req.user.id);
  }

  @Get('verify-payment') // This must match exactly what frontend calls
  @Roles(Role.USER, Role.CLIENT)
  async verifyPayment(
    @Query('tx_ref') txRef: string,
    @Query('transaction_id') transactionId: string,
  ) {
    return this.bookService.verifyTransaction(txRef, transactionId);
  }

  @Get()
  @Roles(Role.USER, Role.CLIENT)
  async getMyBookings(@Req() req: ExpressRequest) {
    // @ts-ignore
    return this.bookService.findAllByUser(req.user.id);
  }

  @Get('provider/incoming')
  @Roles(Role.PROFESSIONAL, Role.ARTISAN)
  async getIncomingBookings(@Req() req: ExpressRequest) {
    // @ts-ignore
    return this.bookService.findProviderBookings(req.user.id);
  }

  @Get('provider/:bookingNumber')
  @Roles(Role.PROFESSIONAL, Role.ARTISAN)
  async getProviderBookingDetails(
    @Param('bookingNumber') bookingNumber: string,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.bookService.findProviderBookingDetails(req.user.id, bookingNumber);
  }

  @Patch('provider/:bookingNumber/status')
  @Roles(Role.PROFESSIONAL, Role.ARTISAN)
  async updateBookingStatus(
    @Param('bookingNumber') bookingNumber: string,
    @Body() dto: UpdateBookingStatusDto,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.bookService.updateBookingStatus(req.user.id, bookingNumber, dto.status);
  }

  @Patch(':bookingNumber/cancel')
  @Roles(Role.USER, Role.CLIENT)
  async cancelClientBooking(
    @Param('bookingNumber') bookingNumber: string,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.bookService.cancelClientBooking(bookingNumber, req.user.id);
  }

  @Get(':id')
  @Roles(Role.USER, Role.CLIENT)
  async getBookingDetails(@Param('id') id: string, @Req() req: ExpressRequest) {
    // @ts-ignore
    return this.bookService.findOne(id, req.user.id);
  }
}
