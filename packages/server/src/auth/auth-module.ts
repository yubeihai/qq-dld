import jwt from 'jsonwebtoken';

const SECRET_ENV_VAR = 'JWT_SECRET';
const DEFAULT_SECRET = 'qq-dld-dev-secret-change-in-production';

export interface TokenPayload {
  accountId: number;
  uin: string;
}

function getSecret(): string {
  return process.env[SECRET_ENV_VAR] || DEFAULT_SECRET;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '24h' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as TokenPayload;
}
