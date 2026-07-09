import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { authPreHandler } from './auth/middleware';
import { authRoutes } from './auth/routes';
import { statusRoutes } from './routes/status';
import { accountRoutes } from './routes/accounts';
import { logRoutes } from './routes/logs';
import { moduleRoutes } from './routes/modules';
import { schedulerRoutes } from './routes/scheduler';
import { settingRoutes } from './routes/settings';
import { DataLayer } from './data/data-layer';

const PUBLIC_ROUTES = new Set<string>([
  '/api/status',
  '/api/auth/qr/start',
  '/api/auth/qr/status',
]);

export async function buildServer(): Promise<FastifyInstance> {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  DataLayer.initialize();

  const server = Fastify({ logger: true });

  await server.register(cors, { origin: true });
  await server.register(formbody);

  server.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url && !PUBLIC_ROUTES.has(routeOptions.url)) {
      const preHandler = routeOptions.preHandler;
      routeOptions.preHandler = Array.isArray(preHandler)
        ? [authPreHandler, ...preHandler]
        : [authPreHandler];
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

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
