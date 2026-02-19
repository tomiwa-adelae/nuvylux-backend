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

  async uploadBrandLogo(userId: string, file: Express.Multer.File) {
    try {
      // 1. Verify User exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
      });
      if (!user) throw new NotFoundException('User not found');

      // 2. Find the brand.
      // IMPORTANT: Since your schema lacks a userId in Brand,
      // this logic looks for a brand with the same ID as the userId
      // OR you should update your schema to link them.
      let brand = await this.prisma.brand.findFirst({
        where: { userId: userId }, // Correctly looking for the owner
      });

      // 3. Create brand if it doesn't exist
      if (!brand) {
        brand = await this.prisma.brand.create({
          data: {
            brandName: `${user.firstName}'s Brand`, // Fallback name
            brandType: 'Consultancy', // Default required field
            userId,
          },
        });
      }

      // 4. Delete old logo from R2 if it exists
      if (brand.brandLogo) {
        try {
          const oldKey = brand.brandLogo.replace(`${this.publicUrl}/`, '');
          await this.s3.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: oldKey,
            }),
          );
        } catch (err) {
          console.warn('Old logo delete failed, skipping...');
        }
      }

      // 5. Upload new logo
      const key = `brand-logos/${brand.id}/${randomUUID()}-${file.originalname}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      const fileUrl = `${this.publicUrl}/${key}`;

      // 6. Update the brand with the new logo URL
      const updatedBrand = await this.prisma.brand.update({
        where: { id: brand.id },
        data: { brandLogo: fileUrl },
      });

      return {
        message: 'Brand logo uploaded successfully',
        brand: updatedBrand,
        logoUrl: fileUrl,
      };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Upload failed');
    }
  }

  async uploadProductImages(productId: string, files: Express.Multer.File[]) {
    const uploadPromises = files.map(async (file) => {
      const key = `products/${productId}/${randomUUID()}-${file.originalname}`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return `${this.publicUrl}/${key}`;
    });

    return Promise.all(uploadPromises);
  }

  async uploadServicesImages(serviceId: string, files: Express.Multer.File[]) {
    const uploadPromises = files.map(async (file) => {
      const key = `services/${serviceId}/${randomUUID()}-${file.originalname}`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return `${this.publicUrl}/${key}`;
    });

    return Promise.all(uploadPromises);
  }

  async uploadServiceBookingImages(
    serviceBookingId: string,
    files: Express.Multer.File[],
  ) {
    const uploadPromises = files.map(async (file) => {
      const key = `services-bookings/${serviceBookingId}/${randomUUID()}-${file.originalname}`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return `${this.publicUrl}/${key}`;
    });

    return Promise.all(uploadPromises);
  }
}
