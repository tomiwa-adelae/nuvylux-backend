import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { SystemRole } from '@prisma/client';
import { CreateArchitectDto } from './dto/create-architect.dto';
import { UserResponseDto } from 'src/auth/dto/user-response.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async selectRole(createOnboardingDto: { role: string }, id: string) {
    if (!createOnboardingDto.role) throw new BadRequestException();

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) throw new NotFoundException('Oops! User not found');

    await this.prisma.user.update({
      where: { id: user?.id },
      data: { role: createOnboardingDto.role.toUpperCase() },
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
    try {
      const user = await this.prisma.user.findUnique({ where: { id } });

      if (!user) throw new NotFoundException('Oops! User not found');

      const updatedUser = await this.prisma.user.update({
        where: { id: user?.id },
        data: { ...updateProfileDto, onboardingCompleted: true },
      });

      return {
        message: 'Profile successfully updated',
        user: plainToClass(UserResponseDto, updatedUser, {
          excludeExtraneousValues: true,
        }),
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'User with this email address already exist.',
        );
      }

      throw new BadRequestException(
        'Unable to update this profile at this time.',
      );
    }
  }

  async createBrandIdentity(dto: CreateBrandDto, userId: string) {
    if (!userId) throw new NotFoundException('Oops! User ID not found');

    const { socialLinks, ...brandData } = dto;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId, role: 'BRAND' },
      });

      if (!user) throw new NotFoundException('Oops! User not found');

      return await this.prisma.$transaction(async (tx) => {
        // 1. Check if a brand record already exists for this user (e.g., from a logo upload)
        const existingBrand = await tx.brand.findFirst({
          where: { userId: user?.id },
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

  async createArchitectProfile(dto: CreateArchitectDto, userId: string) {
    if (!userId) throw new NotFoundException('User ID not found');

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) throw new NotFoundException('User not found');

      return await this.prisma.$transaction(async (tx) => {
        // 1. Upsert the Professional Profile
        // Assuming your Prisma model is called 'professionalProfile'
        const profile = await tx.professionalProfile.upsert({
          where: { userId: userId },
          update: {
            profession: dto.profession,
            businessName: dto.businessName,
            yearsOfExperience: dto.yearsOfExperience,
            bio: dto.bio,
            instagram: dto.instagram,
            website: dto.website,
          },
          create: {
            userId: userId,
            profession: dto.profession,
            businessName: dto.businessName,
            yearsOfExperience: dto.yearsOfExperience,
            bio: dto.bio,
            instagram: dto.instagram,
            website: dto.website,
          },
        });

        // 2. Ensure User Role is set to PROFESSIONAL / ARCHITECT
        // Using SystemRole.PROFESSIONAL (adjust based on your Prisma enums)
        await tx.userRole.upsert({
          where: { userId_role: { userId, role: SystemRole.PROFESSIONAL } },
          update: {},
          create: { userId, role: SystemRole.PROFESSIONAL },
        });

        // 3. Return updated user with profile included
        const updatedUser = await tx.user.findUnique({
          where: { id: userId },
          include: {
            professionalProfile: true,
            roles: true,
          },
        });

        return {
          message: 'Professional profile synchronized successfully',
          user: updatedUser,
        };
      });
    } catch (error) {
      console.error('Architect Onboarding Error:', error);
      throw new InternalServerErrorException(
        'Failed to save professional details',
      );
    }
  }
}
