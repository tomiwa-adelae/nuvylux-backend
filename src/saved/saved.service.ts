import { Injectable } from '@nestjs/common';
import { CreateSavedDto } from './dto/create-saved.dto';
import { UpdateSavedDto } from './dto/update-saved.dto';
import { PrismaService } from 'src/prisma/prisma.service';

// saved.service.ts
@Injectable()
export class SavedService {
  constructor(private prisma: PrismaService) {}

  async toggleSaved(userId: string, productId: string) {
    // 1. Check if it already exists
    const existing = await this.prisma.saved.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (existing) {
      await this.prisma.saved.delete({ where: { id: existing.id } });
      return { saved: false, message: 'Removed from wishlist' };
    }

    await this.prisma.saved.create({
      data: { userId, productId },
    });
    return { saved: true, message: 'Added to wishlist' };
  }

  async getUserSavedItems(userId: string) {
    return this.prisma.saved.findMany({
      where: { userId },
      include: { product: true }, // Returns the actual product data
    });
  }
}
