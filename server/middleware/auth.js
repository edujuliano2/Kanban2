const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'kanban-super-secret-key';

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '7d'
  });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.get(
      'SELECT id, name, email, family_id FROM users WHERE id = ?',
      [payload.id]
    );

    if (!user || !user.family_id) {
      return res.status(401).json({ error: 'Sessão inválida ou sem família associada' });
    }

    req.user = user;
    return next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão inválida ou expirada' });
    }
    return next(err);
  }
}

module.exports = { JWT_SECRET, signToken, requireAuth };
