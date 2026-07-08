const express = require('express');
const { friends } = require('../../db');
const { asyncHandler } = require('../middleware/error-handler');

function createFriendRoutes() {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    const { enabled } = req.query;
    const list = enabled === '1' ? friends.getEnabled() : friends.getAll();
    res.json(list);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { uid, name, type = 'friend', enabled = true } = req.body;
    friends.upsert(uid, name, type, enabled);
    res.json({ success: true });
  }));

  router.post('/batch', asyncHandler(async (req, res) => {
    const { friendsList } = req.body;
    if (!Array.isArray(friendsList)) {
      return res.json({ error: '格式错误' });
    }
    friends.upsertBatch(friendsList);
    res.json({ success: true, count: friendsList.length });
  }));

  router.put('/:uid/enabled', asyncHandler(async (req, res) => {
    const { uid } = req.params;
    const { enabled } = req.body;
    friends.setEnabled(uid, enabled);
    res.json({ success: true });
  }));

  router.delete('/:uid', asyncHandler(async (req, res) => {
    const { uid } = req.params;
    friends.delete(uid);
    res.json({ success: true });
  }));

  router.delete('/', asyncHandler(async (req, res) => {
    friends.clear();
    res.json({ success: true });
  }));

  return router;
}

module.exports = { createFriendRoutes };
