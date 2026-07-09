import { FastifyPluginAsync } from 'fastify';
import { AccountService } from '../auth/account-service';

const accountService = new AccountService();

export const authRoutes: FastifyPluginAsync = async (server) => {
  server.post('/api/auth/login', async (request, reply) => {
    const { uin } = request.body as { uin?: string };
    if (!uin) {
      reply.status(400).send({ error: 'uin is required' });
      return;
    }
    let account = accountService.findByUin(uin);
    if (!account) {
      account = accountService.create({ uin });
    }
    const token = server.jwt.sign({ accountId: account.id, uin: account.uin });
    reply.send({ token, account });
  });

  server.post('/api/auth/logout', async (_request, reply) => {
    reply.send({ success: true });
  });
};
