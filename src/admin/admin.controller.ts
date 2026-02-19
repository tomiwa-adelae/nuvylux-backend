import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminPosition } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── DASHBOARD ────────────────────────────────────────

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ─── USERS ────────────────────────────────────────────

  @Get('users')
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      role,
    });
  }

  @Get('users/:id')
  getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() body: { role?: string }) {
    return this.adminService.updateUser(id, body);
  }

  @Post('users/:id/reset-password')
  resetUserPassword(@Param('id') id: string) {
    return this.adminService.resetUserPassword(id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // ─── ORDERS ───────────────────────────────────────────

  @Get('orders')
  getOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getOrders({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      search,
    });
  }

  @Get('orders/:orderNumber')
  getOrderDetails(@Param('orderNumber') orderNumber: string) {
    return this.adminService.getOrderDetails(orderNumber);
  }

  @Patch('orders/:orderNumber/status')
  updateOrderStatus(
    @Param('orderNumber') orderNumber: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateOrderStatus(orderNumber, status);
  }

  // ─── BOOKINGS ─────────────────────────────────────────

  @Get('bookings')
  getBookings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getBookings({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      search,
    });
  }

  @Get('bookings/:bookingNumber')
  getBookingDetails(@Param('bookingNumber') bookingNumber: string) {
    return this.adminService.getBookingDetails(bookingNumber);
  }

  @Patch('bookings/:bookingNumber/status')
  updateBookingStatus(
    @Param('bookingNumber') bookingNumber: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateBookingStatus(bookingNumber, status);
  }

  // ─── PRODUCTS ─────────────────────────────────────────

  @Get('products')
  getProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getProducts({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      search,
    });
  }

  @Get('products/:id')
  getProductDetails(@Param('id') id: string) {
    return this.adminService.getProductDetails(id);
  }

  @Patch('products/:id/status')
  updateProductStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateProductStatus(id, status);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.adminService.deleteProduct(id);
  }

  // ─── SERVICES ─────────────────────────────────────────

  @Get('services')
  getServices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getServices({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      search,
    });
  }

  @Get('services/:id')
  getServiceDetails(@Param('id') id: string) {
    return this.adminService.getServiceDetails(id);
  }

  @Patch('services/:id/status')
  updateServiceStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateServiceStatus(id, status);
  }

  @Delete('services/:id')
  deleteService(@Param('id') id: string) {
    return this.adminService.deleteService(id);
  }

  // ─── ADMIN TEAM ───────────────────────────────────────

  @Get('admins')
  getAdmins() {
    return this.adminService.getAdmins();
  }

  @Post('admins')
  createAdmin(@Body() dto: CreateAdminDto, @Req() req: ExpressRequest) {
    // @ts-ignore
    return this.adminService.createAdmin(dto, req.user.id);
  }

  @Patch('admins/:id')
  updateAdmin(
    @Param('id') id: string,
    @Body('position') position: AdminPosition,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.adminService.updateAdminPosition(id, position, req.user.id);
  }

  @Delete('admins/:id')
  removeAdmin(@Param('id') id: string, @Req() req: ExpressRequest) {
    // @ts-ignore
    return this.adminService.removeAdmin(id, req.user.id);
  }
}
