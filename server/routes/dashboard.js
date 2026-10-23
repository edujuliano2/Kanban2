const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');
const { attachMemberIds } = require('../card-members');

const router = express.Router();
router.use(requireAuth);

function validDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

router.get('/', asyncHandler(async (req, res) => {
  const date = validDateKey(req.query.date)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  const [boards, members, todayCards] = await Promise.all([
    db.all(
      'SELECT * FROM boards WHERE family_id = ? ORDER BY created_at DESC',
      [req.user.family_id]
    ),
    db.all(
      'SELECT * FROM members WHERE family_id = ? ORDER BY position ASC, id ASC',
      [req.user.family_id]
    ),
    db.all(
      `SELECT cards.*, boards.name AS board_name
       FROM cards
       JOIN lists ON lists.id = cards.list_id
       JOIN boards ON boards.id = lists.board_id
       WHERE boards.family_id = ? AND cards.event_date = ?
       ORDER BY CASE WHEN cards.start_time IS NULL THEN 1 ELSE 0 END,
                cards.start_time ASC, cards.id ASC`,
      [req.user.family_id, date]
    )
  ]);

  res.json({
    date,
    boards,
    members,
    todayEvents: await attachMemberIds(todayCards)
  });
}));

module.exports = router;
