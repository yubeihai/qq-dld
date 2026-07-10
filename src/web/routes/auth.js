const express = require('express');
const { client } = require('../../core/game-client');
const { cookieDb } = require('../../db');
const { startLogin, checkLoginSession, clearSession } = require('../../game/login');
const { asyncHandler } = require('../middleware/error-handler');

function createAuthRoutes() {
  const router = express.Router();

  router.get('/status', asyncHandler(async (req, res) => {
    const sessionResult = await checkLoginSession();
    if (sessionResult && sessionResult.status === 'success') {
      res.json({ loggedIn: true });
      return;
    }

    const valid = await client.checkLoginStatus();
    res.json({ loggedIn: valid });
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const result = await startLogin();
    if (result.qrCode) {
      res.json({ success: true, qrCode: result.qrCode });
    } else {
      res.json({ success: false, error: '无法获取二维码' });
    }
  }));

  router.post('/logout', asyncHandler(async (req, res) => {
    cookieDb.clear();
    client.clearCookie();
    clearSession();
    res.json({ success: true });
  }));

  return router;
}

module.exports = { createAuthRoutes };
