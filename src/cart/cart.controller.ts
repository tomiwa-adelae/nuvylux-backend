import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import type { Response, Request as ExpressRequest } from 'express';

@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  createOrUpdate(@Req() req: ExpressRequest, @Body() dto: CreateCartDto) {
    // @ts-ignore
    const userId = req?.user?.id;
    return this.cartService.upsertItem(userId, dto);
  }

  @Get()
  findAll(@Req() req: ExpressRequest) {
    // @ts-ignore
    const userId = req?.user?.id;
    return this.cartService.getUserCart(userId);
  }

  @Delete('/:id')
  remove(@Req() req: ExpressRequest, @Param('id') itemId: string) {
    // @ts-ignore
    const userId = req?.user?.id;
    return this.cartService.removeItem(userId, itemId);
  }

  @Patch(':id/quantity')
  updateQuantity(
    @Req() req: ExpressRequest,
    @Param('id') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    // @ts-ignore
    const userId = req?.user?.id;
    return this.cartService.updateQuantity(userId, itemId, quantity);
  }
}
