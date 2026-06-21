const { Pool } = require('pg');

// A single shared connection pool for the whole app.
// DATABASE_URL comes from your hosting provider / Supabase / Neon, e.g.:
//   postgresql://user:password@host:5432/dbname
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false }:false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

module.exports = pool;
