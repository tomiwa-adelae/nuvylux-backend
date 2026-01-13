import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { OnboardingModule } from './onboarding/onboarding.module';
import { UploadModule } from './upload/upload.module';
import { ProductModule } from './product/product.module';
import { BrandModule } from './brand/brand.module';

@Module({
  imports: [AuthModule, OnboardingModule, UploadModule, ProductModule, BrandModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
