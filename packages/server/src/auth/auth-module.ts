import jwt from 'jsonwebtoken';

const SECRET_ENV_VAR = 'JWT_SECRET';
const DEFAULT_EXPIRES_IN = '24h';

export interface TokenPayload {
  accountId: number;
  uin: string;
}

function getSecret(): string {
  const secret = process.env[SECRET_ENV_VAR];
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export function signToken(payload: TokenPayload, expiresIn: string = DEFAULT_EXPIRES_IN): string {
  return jwt.sign(payload, getSecret(), { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as TokenPayload;
}

export function refreshToken(token: string): string {
  const payload = verifyToken(token);
  return signToken(payload);
}
