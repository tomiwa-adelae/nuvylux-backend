// src/order/payment-webhook.controller.ts
import {
  Controller,
  Post,
  Body,
  Headers,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { OrderService } from './order.service';
import type { Response } from 'express';

@Controller('webhooks/flutterwave')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(private readonly orderService: OrderService) {}

  @Post()
  async handleWebhook(
    @Body() body: any,
    @Headers('verif-hash') signature: string,
    @Res() res: Response,
  ) {
    // 1. Validate the Secret Hash (set this in your .env and FLW dashboard)
    const secretHash = process.env.FLW_WEBHOOK_HASH;

    if (!signature || signature !== secretHash) {
      this.logger.error('Invalid Webhook Signature');
      return res.status(HttpStatus.UNAUTHORIZED).end();
    }

    this.logger.log(`Received Webhook: ${body.event}`);

    // 2. Extract transaction details
    const { status, tx_ref, id } = body.data;

    if (status === 'successful') {
      try {
        // 3. Trigger the verification and database update
        await this.orderService.verifyTransaction(tx_ref, id);
      } catch (error) {
        this.logger.error(`Webhook Processing Failed: ${error.message}`);
      }
    }

    // 4. Always return 200 OK so Flutterwave doesn't keep retrying
    return res.status(HttpStatus.OK).end();
  }
}
