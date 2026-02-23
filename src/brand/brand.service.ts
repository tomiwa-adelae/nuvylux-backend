import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { notDeleted } from 'src/utils/prismaFilters';

@Injectable()
export class BrandService {
  constructor(private prisma: PrismaService) {}
  create(createBrandDto: CreateBrandDto) {
    return 'This action adds a new brand';
  }

  findAll() {
    return `This action returns all brand`;
  }

  async getBrandDetails(id: string) {
    if (!id) throw new NotFoundException();

    const user = await this.prisma.user.findUnique({
      where: { id, role: 'BRAND' },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const brand = await this.prisma.brand.findUnique({
      where: { userId: user.id },
      include: { socials: true },
    });

    if (!brand) throw new NotFoundException('Oops! Brand not found');

    return brand;
  }

  async getPublicBrands(query?: { search?: string; brandType?: string }) {
    return this.prisma.brand.findMany({
      where: {
        ...notDeleted(),
        ...(query?.brandType && { brandType: query.brandType }),
        ...(query?.search && {
          OR: [
            { brandName: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        brandName: true,
        brandLogo: true,
        brandType: true,
        description: true,
        website: true,
        brandColor: true,
        socials: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: number, updateBrandDto: UpdateBrandDto) {
    return `This action updates a #${id} brand`;
  }

  remove(id: number) {
    return `This action removes a #${id} brand`;
  }
}
