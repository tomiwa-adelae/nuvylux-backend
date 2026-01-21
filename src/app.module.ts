import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { OnboardingModule } from './onboarding/onboarding.module';
import { UploadModule } from './upload/upload.module';
import { ProductModule } from './product/product.module';
import { BrandModule } from './brand/brand.module';
import { SavedModule } from './saved/saved.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { UserModule } from './user/user.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [AuthModule, OnboardingModule, UploadModule, ProductModule, BrandModule, SavedModule, CartModule, OrderModule, UserModule, ServicesModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
