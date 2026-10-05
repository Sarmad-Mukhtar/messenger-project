import {
BadRequestException,
Injectable,
UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
constructor(
private readonly prisma: PrismaService,
private readonly jwtService: JwtService,
) {}

async register(registerDto: RegisterDto) {
const { username, email, password, displayName } = registerDto;


const existingUser = await this.prisma.user.findFirst({
  where: {
    OR: [{ username }, { email }],
  },
});

if (existingUser) {
  throw new BadRequestException(
    'Username or email is already registered',
  );
}

const passwordHash = await bcrypt.hash(password, 12);

const user = await this.prisma.user.create({
  data: {
    username,
    email,
    passwordHash,
    displayName: displayName ?? username,
  },
  select: {
    id: true,
    username: true,
    email: true,
    displayName: true,
    avatarUrl: true,
    createdAt: true,
    updatedAt: true,
  },
});

return {
  message: 'Registration successful',
  user,
};


}

async login(loginDto: LoginDto) {
const { email, password } = loginDto;


const user = await this.prisma.user.findUnique({
  where: { email },
});

if (!user) {
  throw new UnauthorizedException('Invalid email or password');
}

const passwordMatches = await bcrypt.compare(
  password,
  user.passwordHash,
);

if (!passwordMatches) {
  throw new UnauthorizedException('Invalid email or password');
}

const accessToken = this.jwtService.sign({
  sub: user.id,
  email: user.email,
  username: user.username,
});

const refreshToken = this.jwtService.sign(
  {
    sub: user.id,
    type: 'refresh',
  },
  {
    expiresIn: '7d',
  },
);

const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

await this.prisma.user.update({
  where: { id: user.id },
  data: {
    refreshTokenHash,
  },
});

return {
  message: 'Login successful',
  accessToken,
  refreshToken,
  user: {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  },
};


}

async refresh(refreshToken: string) {
try {
const payload = this.jwtService.verify(refreshToken);


  if (payload.type !== 'refresh') {
    throw new UnauthorizedException('Invalid refresh token');
  }

  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user || !user.refreshTokenHash) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  const tokenMatches = await bcrypt.compare(
    refreshToken,
    user.refreshTokenHash,
  );

  if (!tokenMatches) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  const accessToken = this.jwtService.sign({
    sub: user.id,
    email: user.email,
    username: user.username,
  });

  return {
    message: 'Token refreshed successfully',
    accessToken,
  };
} catch {
  throw new UnauthorizedException('Invalid refresh token');
}


}

async logout(userId: string) {
await this.prisma.user.update({
where: { id: userId },
data: {
refreshTokenHash: null,
},
});


return {
  message: 'Logout successful',
};

}
}
