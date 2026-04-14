import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminGuard } from 'src/guards/admin.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PrismaService, AdminGuard],
})
export class AdminModule {}
