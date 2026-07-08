const express = require('express');
const { client } = require('../../core/game-client');
const { cookieDb } = require('../../db');
const { login } = require('../../game/login');
const { asyncHandler } = require('../middleware/error-handler');

function createAuthRoutes() {
  const router = express.Router();

  router.get('/status', asyncHandler(async (req, res) => {
    const valid = await client.checkLoginStatus();
    res.json({ loggedIn: valid });
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const result = await login();
    if (result.qrCode) {
      res.json({ success: true, qrCode: result.qrCode });
    } else {
      client.clearCookie();
      res.json({ success: true });
    }
  }));

  router.post('/logout', asyncHandler(async (req, res) => {
    cookieDb.clear();
    client.clearCookie();
    res.json({ success: true });
  }));

  return router;
}

module.exports = { createAuthRoutes };
