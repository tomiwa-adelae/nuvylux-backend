import { IsEnum } from 'class-validator';

export enum AllowedBookingStatus {
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class UpdateBookingStatusDto {
  @IsEnum(AllowedBookingStatus, {
    message:
      'Status must be one of: CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED',
  })
  status: AllowedBookingStatus;
}
