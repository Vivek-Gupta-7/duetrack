require('dotenv').config();

console.log("DATABASE_URL =", process.env.DATABASE_URL);


// Simple migration runner: applies schema.sql to the configured database.
// Usage: npm run migrate
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema.sql ...');
  try {
    await pool.query(sql);
    console.log('✔ Database schema is up to date.');
  } catch (err) {
    console.error('✖ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
