import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Allows any ADMINISTRATOR regardless of admin position.
 * Use this on blog routes so CONTENT_WRITER admins can access them.
 */
@Injectable()
export class BlogGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
