import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }

  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ) {
    console.log('JWT GUARD CHECK:', {
      error: err?.message,
      user: user
        ? {
            userId: user.userId,
            username: user.username,
          }
        : null,
      info: info?.message,
    });

    return super.handleRequest(
      err,
      user,
      info,
      context,
    );
  }
}
