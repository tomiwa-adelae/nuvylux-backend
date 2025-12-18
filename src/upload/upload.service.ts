import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { notDeleted } from 'src/utils/prismaFilters';

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket = process.env.CLOUDFLARE_BUCKET_NAME;
  private publicUrl = process.env.CLOUDFLARE_PUBLIC_URL;

  constructor(private prisma: PrismaService) {
    this.s3 = new S3Client({
      region: 'auto', // Cloudflare uses 'auto'
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
      },
    });
  }

  async uploadProfilePicture(userId: string, file: Express.Multer.File) {
    try {
      // 🔹 Fetch user to check for existing image
      const user = await this.prisma.user.findUnique({
        where: { id: userId, ...notDeleted() },
      });
      if (!user) throw new NotFoundException('User not found');

      // 🔹 If user already has an image, delete it from Cloudflare R2
      if (user.image) {
        try {
          // Extract the object key from the stored image URL
          const oldKey = user.image.replace(`${this.publicUrl}/`, '');
          await this.s3.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: oldKey,
            }),
          );
        } catch (deleteErr) {
          console.warn(
            'Failed to delete old image from Cloudflare R2:',
            deleteErr,
          );
          // We won’t block the upload just because delete failed
        }
      }

      // 🔹 Generate a new key and upload new image
      const key = `profile-pictures/${userId}/${randomUUID()}-${file.originalname}`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      const fileUrl = `${this.publicUrl}/${key}`;

      // 🔹 Update user record
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { image: fileUrl },
      });

      return {
        message: 'Profile picture uploaded successfully!',
        imageUrl: fileUrl,
        user: updatedUser,
      };
    } catch (err) {
      throw new InternalServerErrorException('Cloudflare R2 upload failed');
    }
  }
}
