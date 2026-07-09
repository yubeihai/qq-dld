import { FastifyPluginAsync } from 'fastify';
import { signToken } from './auth-module';
import { AccountService } from './account-service';
import { QrSessionManager } from './qr-session-manager';
import { QqLoginClient } from './qq-login-client';

const sessionManager = new QrSessionManager();
const qqClient = new QqLoginClient();
const accountService = new AccountService();

export const authRoutes: FastifyPluginAsync = async (server) => {
  server.post('/api/auth/qr/start', async (_request, reply) => {
    try {
      const cookieJar = new Map<string, string>();
      const { qrImage, qrsig } = await qqClient.getQrCode(cookieJar);
      const session = sessionManager.create(qrsig, cookieJar);
      reply.send({ sessionId: session.id, qrImage });
    } catch (error) {
      reply
        .status(502)
        .send({ error: 'Failed to fetch QR code', detail: String(error) });
    }
  });

  server.get('/api/auth/qr/status', async (request, reply) => {
    const { id } = request.query as { id?: string };
    if (!id) {
      reply.status(400).send({ error: 'id is required' });
      return;
    }
    const session = sessionManager.get(id);
    if (!session) {
      reply.status(404).send({ error: 'Session not found' });
      return;
    }
    if (session.status === 'expired' || sessionManager.isExpired(session)) {
      sessionManager.updateStatus(id, 'expired');
      reply.send({ status: 'expired' });
      return;
    }
    if (session.status === 'success') {
      reply.send({ status: 'success' });
      return;
    }

    try {
      const result = await qqClient.checkStatus(session.cookieJar, session.ptqrtoken);

      if (result.code === 66) {
        reply.send({ status: 'waiting' });
        return;
      }
      if (result.code === 67) {
        sessionManager.updateStatus(id, 'scanned');
        reply.send({ status: 'scanned' });
        return;
      }
      if (result.code === 65) {
        sessionManager.updateStatus(id, 'expired');
        reply.send({ status: 'expired' });
        return;
      }

      if (result.code === 0 && result.callbackUrl) {
        const login = await qqClient.completeLogin(
          result.callbackUrl,
          session.cookieJar,
          result.nickname,
        );

        let account = accountService.findByUin(login.uin);
        if (account) {
          accountService.updateProfile(account.id, {
            cookies: login.cookieString,
            nickname: login.nickname,
          });
          account = accountService.findById(account.id);
        } else {
          account = accountService.create({
            uin: login.uin,
            nickname: login.nickname,
            cookies: login.cookieString,
          });
        }
        if (!account) {
          reply.status(500).send({ error: 'Account persistence failed' });
          return;
        }

        const token = signToken({ accountId: account.id, uin: account.uin });
        accountService.switch(account.id);
        sessionManager.updateStatus(id, 'success', {
          uin: login.uin,
          nickname: login.nickname,
        });

        reply.send({ status: 'success', token, account: accountService.toPublic(account) });
        return;
      }

      reply.send({ status: 'waiting' });
    } catch (error) {
      reply
        .status(502)
        .send({ error: 'Status check failed', detail: String(error) });
    }
  });

  server.post('/api/auth/logout', async (_request, reply) => {
    reply.send({ success: true });
  });
};
