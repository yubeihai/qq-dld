import { FastifyPluginAsync } from 'fastify';
import { AccountService } from '../auth/account-service';

const accountService = new AccountService();

export const accountRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/accounts', async (_request, reply) => {
    const accounts = accountService.list();
    reply.send({ accounts });
  });

  server.post('/api/accounts', async (request, reply) => {
    const { uin, nickname, cookies } = request.body as { uin?: string; nickname?: string; cookies?: string };
    if (!uin) {
      reply.status(400).send({ error: 'uin is required' });
      return;
    }
    const account = accountService.create({ uin, nickname, cookies });
    reply.status(201).send({ account });
  });

  server.delete('/api/accounts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = accountService.delete(parseInt(id, 10));
    if (!deleted) {
      reply.status(404).send({ error: 'Account not found' });
      return;
    }
    reply.send({ success: true });
  });
};
