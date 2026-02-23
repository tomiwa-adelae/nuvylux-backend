import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(@Body() dto: CreateReviewDto, @Req() req: ExpressRequest) {
    // @ts-ignore
    return this.reviewService.create(dto, req.user.id);
  }

  @Get('product/:productId')
  @Public()
  findForProduct(@Param('productId') productId: string) {
    return this.reviewService.findForProduct(productId);
  }

  @Get('service/:serviceId')
  @Public()
  findForService(@Param('serviceId') serviceId: string) {
    return this.reviewService.findForService(serviceId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @Req() req: ExpressRequest,
  ) {
    // @ts-ignore
    return this.reviewService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: ExpressRequest) {
    // @ts-ignore
    const user = req.user as any;
    const isAdmin = user.role === 'ADMINISTRATOR';
    return this.reviewService.remove(id, user.id, isAdmin);
  }

  @Get('admin/all')
  @Roles(Role.ADMINISTRATOR)
  findAll() {
    return this.reviewService.findAll();
  }
}
