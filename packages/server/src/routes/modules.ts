import { FastifyPluginAsync } from 'fastify';
import { DataLayer } from '../data/data-layer';

export const moduleRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/modules', async (_request, reply) => {
    const db = DataLayer.getInstance().getDb();
    const rows = db.prepare('SELECT * FROM module_configs ORDER BY module_id').all();
    reply.send({ modules: rows });
  });

  server.post('/api/run/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    reply.send({ success: true, moduleId: id, result: 'not implemented yet' });
  });
};
