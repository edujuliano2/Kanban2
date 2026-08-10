const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const hasDbUrl = !!process.env.DATABASE_URL;

function failingDriver(message) {
  const throwIt = async () => {
    throw new Error(message);
  };
  return {
    get: throwIt,
    all: throwIt,
    run: throwIt,
    exec: throwIt
  };
}

let driver;

if (hasDbUrl) {
  try {
    driver = require('./db.pg');
  } catch (err) {
    driver = failingDriver(`Falha ao carregar o driver do banco: ${err.message}`);
  }
} else if (isProd) {
  driver = failingDriver('DATABASE_URL não configurada no ambiente de produção');
} else {
  driver = require('./db.sqlite');
}

module.exports = driver;