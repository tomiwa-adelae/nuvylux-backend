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
import { SavedService } from './saved.service';
import { CreateSavedDto } from './dto/create-saved.dto';
import { UpdateSavedDto } from './dto/update-saved.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { Response, Request as ExpressRequest } from 'express';

// saved.controller.ts
@Controller('saved')
@UseGuards(JwtAuthGuard) // Ensure only logged-in users can save
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Post('toggle')
  toggle(@Req() req: any, @Body() dto: CreateSavedDto) {
    return this.savedService.toggleSaved(req.user.id, dto.productId);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.savedService.getUserSavedItems(req.user.id);
  }
}
