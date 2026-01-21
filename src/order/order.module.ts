import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentWebhookController } from './payment-webhook.controller';

@Module({
  controllers: [OrderController, PaymentWebhookController],
  providers: [OrderService, PrismaService],
})
export class OrderModule {}
