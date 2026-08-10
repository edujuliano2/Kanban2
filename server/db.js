module.exports = process.env.DATABASE_URL
  ? require('./db.pg')
  : require('./db.sqlite');