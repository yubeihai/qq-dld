import { Router, type Request, type Response } from 'express';
import { signToken } from './auth-module';
import { authMiddleware } from './middleware';
import { AccountService } from './account-service';

export function createAccountRoutes(): Router {
  const router = Router();
  const accountService = new AccountService();

  router.post('/login', (req: Request, res: Response) => {
    const { uin } = req.body || {};
    if (!uin) {
      res.status(400).json({ error: 'uin is required' });
      return;
    }
    let account = accountService.findByUin(uin);
    if (!account) {
      account = accountService.create({ uin });
    }
    const token = signToken({ accountId: account.id, uin: account.uin });
    res.json({ token, account });
  });

  router.post('/logout', authMiddleware, (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  router.get('/status', authMiddleware, (req: Request, res: Response) => {
    res.json({ loggedIn: true, account: req.account });
  });

  router.get('/', authMiddleware, (_req: Request, res: Response) => {
    const accounts = accountService.findAll();
    res.json({ accounts });
  });

  router.post('/', authMiddleware, (req: Request, res: Response) => {
    const { uin, nickname, cookies } = req.body || {};
    if (!uin) {
      res.status(400).json({ error: 'uin is required' });
      return;
    }
    const account = accountService.create({ uin, nickname, cookies });
    res.status(201).json({ account });
  });

  router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const deleted = accountService.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
