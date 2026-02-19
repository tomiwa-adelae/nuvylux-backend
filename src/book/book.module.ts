import { Module } from '@nestjs/common';
import { BookService } from './book.service';
import { BookController } from './book.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [
    UploadModule, // 👈 REQUIRED
  ],
  controllers: [BookController],
  providers: [BookService, PrismaService],
})
export class BookModule {}
