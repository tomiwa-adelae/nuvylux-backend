import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { PrismaService } from 'src/prisma/prisma.service';

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
}
