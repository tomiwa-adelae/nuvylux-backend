import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [
    UploadModule, // 👈 REQUIRED
  ],
  controllers: [ServicesController],
  providers: [ServicesService, PrismaService],
})
export class ServicesModule {}
