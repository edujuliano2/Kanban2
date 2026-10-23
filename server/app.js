const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const listRoutes = require('./routes/lists');
const cardRoutes = require('./routes/cards');
const memberRoutes = require('./routes/members');
const agendaRoutes = require('./routes/agenda');
const familyRoutes = require('./routes/family');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const { asyncHandler } = require('./helpers');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', asyncHandler(async (req, res) => {
  try {
    await db.get('SELECT 1 AS one');
    res.json({ ok: true, db: 'ok' });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'error', error: err.message });
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api', listRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/settings', settingsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

app.use((err, req, res, next) => {
  console.error('[API ERRO]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor'
  });
});

module.exports = app;