// order/order.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Req,
  Patch,
  Query,
} from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrderItemStatus } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto, @Req() req: ExpressRequest) {
    // @ts-ignore
    return this.orderService.create(createOrderDto, req.user.id);
  }

  @Get()
  findUserOrders(@Req() req: ExpressRequest) {
    // @ts-ignore
    return this.orderService.findUserOrders(req.user.id);
  }

  @Get('verify-payment') // This must match exactly what frontend calls
  async verifyPayment(
    @Query('tx_ref') txRef: string,
    @Query('transaction_id') transactionId: string,
  ) {
    return this.orderService.verifyTransaction(txRef, transactionId);
  }

  @Get(':orderNumber')
  findUserOrdersDetails(
    @Param('orderNumber') orderNumber: string,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.orderService.findUserOrdersDetails(req.user.id, orderNumber);
  }

  @Patch(':id/cancel')
  cancelOrder(@Param('id') id: string, @Req() req: ExpressRequest) {
    // @ts-ignore
    return this.orderService.cancelOrder(id, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: ExpressRequest) {
    // @ts-ignore
    return this.orderService.findOne(id, req.user.id);
  }

  @Post(':orderNumber/pay')
  initializePayment(
    @Param('orderNumber') orderNumber: string,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.orderService.initializePayment(orderNumber, req.user.id);
  }

  @Get('brand/all')
  findBrandOrders(@Req() req: ExpressRequest) {
    // @ts-ignore
    return this.orderService.findBrandOrders(req.user.id);
  }

  @Get('brand/details/:orderNumber')
  findBrandOrderDetails(
    @Param('orderNumber') orderNumber: string,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.orderService.findBrandOrderDetails(req.user.id, orderNumber);
  }

  @Patch(':id/brand-status')
  updateBrandStatus(
    @Param('id') id: string,
    @Body('status') status: OrderItemStatus,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.orderService.updateBrandItemStatus(req.user.id, id, status);
  }
}
