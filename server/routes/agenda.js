const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');
const { attachMemberIds } = require('../card-members');

const router = express.Router();
router.use(requireAuth);

function todayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function validKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

router.get('/', asyncHandler(async (req, res) => {
  const fallback = todayKey();
  const from = validKey(req.query.from) ? req.query.from : fallback;
  const to = validKey(req.query.to) ? req.query.to : from;

  const [members, events] = await Promise.all([
    db.all(
      'SELECT * FROM members WHERE family_id = ? ORDER BY position ASC, id ASC',
      [req.user.family_id]
    ),
    db.all(
      `SELECT cards.*, lists.board_id, boards.name AS board_name
       FROM cards
       JOIN lists ON lists.id = cards.list_id
       JOIN boards ON boards.id = lists.board_id
       WHERE boards.family_id = ?
         AND cards.event_date IS NOT NULL
         AND cards.event_date >= ?
         AND cards.event_date <= ?
       ORDER BY cards.event_date ASC,
         CASE WHEN cards.start_time IS NULL THEN 0 ELSE 1 END,
         cards.start_time ASC,
         cards.id ASC`,
      [req.user.family_id, from, to]
    )
  ]);

  res.json({ events: await attachMemberIds(events), members });
}));

module.exports = router;
