import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { Request as ExpressRequest } from 'express';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateArchitectDto } from './dto/create-architect.dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('role')
  selectRole(
    @Req() req: ExpressRequest,
    @Body() createOnboardingDto: { role: string },
  ) {
    return this.onboardingService.selectRole(
      createOnboardingDto,
      // @ts-ignore
      req?.user?.id!,
    );
  }

  @Post('interests')
  selectInterests(
    @Req() req: ExpressRequest,
    @Body() selectedInterests: string[],
  ) {
    return this.onboardingService.selectInterests(
      selectedInterests,
      // @ts-ignore
      req?.user?.id!,
    );
  }

  @Post('architect-setup')
  async setupArchitect(
    @Req() req: any,
    @Body() createArchitectDto: CreateArchitectDto,
  ) {
    const userId = req.user.id;
    return this.onboardingService.createArchitectProfile(
      createArchitectDto,
      userId,
    );
  }

  @Post('profile')
  profile(
    @Req() req: ExpressRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.onboardingService.updateProfile(
      updateProfileDto,
      // @ts-ignore
      req?.user?.id!,
    );
  }

  @Post('brand')
  async setupBrand(@Req() req: any, @Body() createBrandDto: CreateBrandDto) {
    const userId = req.user.id;

    return this.onboardingService.createBrandIdentity(createBrandDto, userId);
  }
}
