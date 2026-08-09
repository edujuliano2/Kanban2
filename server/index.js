const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const listRoutes = require('./routes/lists');
const cardRoutes = require('./routes/cards');
const settingsRoutes = require('./routes/settings');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api', listRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/settings', settingsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API Kanban rodando em http://localhost:${PORT}`);
});
