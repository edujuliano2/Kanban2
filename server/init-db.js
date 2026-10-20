const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { pool } = require('./db.pg');

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('Defina a variável DATABASE_URL (ex.: postgres://...).');
    process.exit(1);
  }

  const dbPg = require('./db.pg');
  try {
    await dbPg.initSchema();
    console.log('Schema criado/verificado no PostgreSQL com sucesso.');
  } catch (err) {
    console.error('Erro ao inicializar o schema:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();