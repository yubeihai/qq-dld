import { FastifyPluginAsync } from 'fastify';

export const statusRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/status', async (_request, reply) => {
    reply.send({ success: true, data: { status: 'ok' } });
  });
};
