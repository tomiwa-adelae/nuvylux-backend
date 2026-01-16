import { Module } from '@nestjs/common';
import { SavedService } from './saved.service';
import { SavedController } from './saved.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [SavedController],
  providers: [SavedService, PrismaService],
})
export class SavedModule {}
