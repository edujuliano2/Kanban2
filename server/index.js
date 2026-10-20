const path = require('path');

// Carrega .env da raiz do projeto e, se existir, o .env da pasta server.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API Agenda da Família rodando em http://localhost:${PORT}`);
});
