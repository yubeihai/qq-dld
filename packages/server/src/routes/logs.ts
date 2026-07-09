import { FastifyPluginAsync } from 'fastify';
import { DataLayer } from '../data/data-layer';

export const logRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/logs', async (request, reply) => {
    const query = request.query as { accountId?: string; limit?: string };
    const db = DataLayer.getInstance().getDb();
    const rows = db.prepare('SELECT * FROM exec_logs ORDER BY id DESC LIMIT ?').all(parseInt(query.limit || '50', 10));
    reply.send({ logs: rows });
  });

  server.delete('/api/logs', async (_request, reply) => {
    const db = DataLayer.getInstance().getDb();
    db.exec('DELETE FROM exec_logs');
    reply.send({ success: true });
  });
};
