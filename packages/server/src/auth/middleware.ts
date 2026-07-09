import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, type TokenPayload } from './auth-module';

export async function authPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing or malformed authorization header' });
    return;
  }
  const token = header.slice(7);
  try {
    request.user = verifyToken(token) as object;
  } catch {
    reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export function getUser(request: FastifyRequest): TokenPayload | undefined {
  return request.user as TokenPayload | undefined;
}
