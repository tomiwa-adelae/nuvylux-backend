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
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { Response, Request as ExpressRequest } from 'express';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateBrandDto } from './dto/create-brand.dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('role')
  @Roles(Role.USER)
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
  @Roles(Role.USER)
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

  @Post('profile')
  @Roles(Role.USER)
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
  @Roles(Role.USER) // Ensure they are logged in
  async setupBrand(@Req() req: any, @Body() createBrandDto: CreateBrandDto) {
    const userId = req.user.id;

    return this.onboardingService.createBrandIdentity(createBrandDto, userId);
  }
}
