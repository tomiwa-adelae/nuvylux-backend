import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PrismaService } from 'src/prisma/prisma.service';

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
      where: { id, role: 'brand' },
    });

    if (!user) throw new NotFoundException('Oops! User not found');

    const brand = await this.prisma.brand.findUnique({
      where: { userId: user.id },
    });

    if (!brand) throw new NotFoundException('Oops! Brand not found');

    return brand;
  }

  update(id: number, updateBrandDto: UpdateBrandDto) {
    return `This action updates a #${id} brand`;
  }

  remove(id: number) {
    return `This action removes a #${id} brand`;
  }
}
