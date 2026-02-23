import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { Response, Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import { Public } from 'src/decorators/public.decorator';

@Controller('brand')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get('public/explore')
  @Public()
  getPublicBrands(
    @Query('search') search?: string,
    @Query('brandType') brandType?: string,
  ) {
    return this.brandService.getPublicBrands({ search, brandType });
  }

  @Post()
  create(@Body() createBrandDto: CreateBrandDto) {
    return this.brandService.create(createBrandDto);
  }

  @Get('details')
  @Roles(Role.USER, Role.BRAND)
  getBrandDetails(@Req() req: ExpressRequest) {
    return this.brandService.getBrandDetails(
      // @ts-ignore
      req?.user?.id!,
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBrandDto: UpdateBrandDto) {
    return this.brandService.update(+id, updateBrandDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.brandService.remove(+id);
  }
}
