import { FastifyPluginAsync } from 'fastify';
import { DataLayer } from '../data/data-layer';

export const settingRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/settings', async (_request, reply) => {
    const db = DataLayer.getInstance().getDb();
    const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
    reply.send({ settings: rows });
  });

  server.post('/api/settings', async (request, reply) => {
    const { key, value, accountId } = request.body as { key: string; value: string; accountId?: number };
    if (!key) {
      reply.status(400).send({ error: 'key is required' });
      return;
    }
    const db = DataLayer.getInstance().getDb();
    db.prepare('INSERT OR REPLACE INTO settings (account_id, key, value) VALUES (?, ?, ?)').run(accountId || null, key, value);
    reply.send({ success: true });
  });
};
