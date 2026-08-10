const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const hasDbUrl = !!process.env.DATABASE_URL;

if (isProd && !hasDbUrl) {
  const msg = 'DATABASE_URL não configurada no ambiente de produção';
  module.exports = {
    async get() { throw new Error(msg); },
    async all() { throw new Error(msg); },
    async run() { throw new Error(msg); },
    async exec() { throw new Error(msg); }
  };
} else {
  module.exports = require(hasDbUrl ? './db.pg' : './db.sqlite');
}