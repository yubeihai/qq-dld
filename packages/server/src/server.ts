import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth';
import { statusRoutes } from './routes/status';
import { accountRoutes } from './routes/accounts';
import { logRoutes } from './routes/logs';
import { moduleRoutes } from './routes/modules';
import { schedulerRoutes } from './routes/scheduler';
import { settingRoutes } from './routes/settings';
import { DataLayer } from './data/data-layer';

const JWT_SECRET = process.env.JWT_SECRET || 'qq-dld-dev-secret-for-now';

export async function buildServer(): Promise<FastifyInstance> {
  DataLayer.initialize();

  const server = Fastify({ logger: true });

  await server.register(cors, { origin: true });
  await server.register(formbody);
  await server.register(jwt, { secret: JWT_SECRET });

  server.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url && routeOptions.url !== '/api/status' && routeOptions.url !== '/api/auth/login') {
      const preHandler = routeOptions.preHandler;
      if (preHandler) {
        routeOptions.preHandler = Array.isArray(preHandler) ? [authHook, ...preHandler] : [authHook, preHandler];
      } else {
        routeOptions.preHandler = [authHook];
      }
    }
  });

  await server.register(statusRoutes);
  await server.register(authRoutes);
  await server.register(accountRoutes);
  await server.register(logRoutes);
  await server.register(moduleRoutes);
  await server.register(schedulerRoutes);
  await server.register(settingRoutes);

  server.setErrorHandler((error: Error & { statusCode?: number }, _request: FastifyRequest, reply: FastifyReply) => {
    reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  });

  return server;
}

export async function startServer(): Promise<FastifyInstance> {
  const server = await buildServer();
  const port = parseInt(process.env.PORT || '3001', 10);
  await server.listen({ port, host: '0.0.0.0' });
  console.log(`Fastify server listening on port ${port}`);
  return server;
}

async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}
