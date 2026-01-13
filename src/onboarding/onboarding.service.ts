import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { SystemRole } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async selectRole(createOnboardingDto: { role: string }, id: string) {
    if (!createOnboardingDto.role) throw new BadRequestException();

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) throw new NotFoundException('Oops! User not found');

    await this.prisma.user.update({
      where: { id: user?.id },
      data: { role: createOnboardingDto.role },
    });

    return { message: 'Role successfully updated' };
  }

  async selectInterests(selectedInterests: string[], id: string) {
    if (selectedInterests.length < 2)
      throw new BadRequestException(
        'Oops! Please select at least 2 interests!',
      );

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) throw new NotFoundException('Oops! User not found');

    await this.prisma.user.update({
      where: { id: user?.id },
      data: { interests: selectedInterests },
    });

    return { message: 'Interests successfully added' };
  }

  async updateProfile(updateProfileDto: UpdateProfileDto, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) throw new NotFoundException('Oops! User not found');

    await this.prisma.user.update({
      where: { id: user?.id },
      data: { ...updateProfileDto },
    });

    return { message: 'Profile successfully updated' };
  }

  async createBrandIdentity(dto: CreateBrandDto, userId: string) {
    const { socialLinks, ...brandData } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Check if a brand record already exists for this user (e.g., from a logo upload)
        const existingBrand = await tx.brand.findFirst({
          where: { userId: userId },
        });

        let brand;

        if (existingBrand) {
          // 2. UPDATE existing brand with the form details
          brand = await tx.brand.update({
            where: { id: existingBrand.id },
            data: {
              brandName: brandData.brandName,
              brandType: brandData.brandType,
              // Only update logo if provided in the DTO, otherwise keep the uploaded one
              brandLogo: brandData.brandLogo || existingBrand.brandLogo,
              description: brandData.description,
              website: brandData.website,
            },
          });
        } else {
          // 3. CREATE a new brand if none exists
          brand = await tx.brand.create({
            data: {
              brandName: brandData.brandName,
              brandType: brandData.brandType,
              brandLogo: brandData.brandLogo,
              description: brandData.description,
              website: brandData.website,
              userId: userId,
            },
          });
        }

        // 4. Handle Socials: Clear old ones and add new ones to prevent duplicates
        await tx.socials.deleteMany({
          where: { brandId: brand.id },
        });

        if (socialLinks && socialLinks.length > 0) {
          await tx.socials.createMany({
            data: socialLinks
              .filter((link) => link.url && link.url.trim() !== '')
              .map((link) => ({
                url: link.url,
                userId: userId,
                brandId: brand.id,
              })),
          });
        }

        // 5. Ensure User Role is updated to BRAND
        await tx.userRole.upsert({
          where: { userId_role: { userId, role: SystemRole.BRAND } },
          update: {},
          create: { userId, role: SystemRole.BRAND },
        });

        // 6. Return fully included user object for the frontend store
        const updatedUser = await tx.user.findUnique({
          where: { id: userId },
          include: {
            brand: { include: { socials: true } },
            roles: true,
          },
        });

        return {
          message: 'Brand identity synchronized successfully',
          user: updatedUser,
        };
      });
    } catch (error) {
      console.error('Onboarding Error:', error);
      throw new InternalServerErrorException(
        'Failed to finalize brand identity',
      );
    }
  }
}
