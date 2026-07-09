import { FastifyPluginAsync } from 'fastify';

export const schedulerRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/scheduler/status', async (_request, reply) => {
    reply.send({ running: false, nextRun: null });
  });
};
