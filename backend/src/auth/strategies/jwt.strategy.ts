import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const secret =
      configService.getOrThrow<string>('JWT_SECRET');

    console.log('JWT Strategy initialized');

    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    username: string;
  }) {
    console.log('JWT validate() called:', {
      sub: payload.sub,
      username: payload.username,
    });

    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }
}


