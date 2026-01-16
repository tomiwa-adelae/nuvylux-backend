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
} from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    return this.orderService.create(createOrderDto, req.user.id);
  }

  @Get()
  findUserOrders(@Request() req) {
    return this.orderService.findUserOrders(req.user.id);
  }

  @Get(':orderNumber')
  findUserOrdersDetails(
    @Param('orderNumber') orderNumber: string,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.orderService.findUserOrdersDetails(req.user.id, orderNumber);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.orderService.findOne(id, req.user.id);
  }
}
