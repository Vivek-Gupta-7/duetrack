const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { ApiError, asyncHandler } = require('../middleware/errors');
const { jwtSecret, jwtExpiresIn, bcryptSaltRounds } = require('../config/env');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(owner) {
  return jwt.sign({ sub: owner.id, email: owner.email }, jwtSecret, { expiresIn: jwtExpiresIn });
}

function toPublicOwner(owner) {
  return { id: owner.id, shopName: owner.shop_name, email: owner.email, createdAt: owner.created_at };
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { shopName, email, password } = req.body;

  if (!shopName || String(shopName).trim().length < 2) {
    throw new ApiError(400, 'Enter your shop or business name.');
  }
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    throw new ApiError(400, 'Enter a valid email address.');
  }
  if (!password || String(password).length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await pool.query('SELECT id FROM shop_owners WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'An account with this email already exists. Please log in instead.');
  }

  const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);

  const result = await pool.query(
    `INSERT INTO shop_owners (shop_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, shop_name, email, created_at`,
    [String(shopName).trim(), normalizedEmail, passwordHash]
  );

  const owner = result.rows[0];
  const token = signToken(owner);

  res.status(201).json({ token, account: toPublicOwner(owner) });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !EMAIL_RE.test(String(email).trim())) {
    throw new ApiError(400, 'Enter a valid email address.');
  }
  if (!password) {
    throw new ApiError(400, 'Enter your password.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const result = await pool.query('SELECT * FROM shop_owners WHERE email = $1', [normalizedEmail]);
  const owner = result.rows[0];

  // Same error message whether the email doesn't exist or the password is
  // wrong — avoids leaking which emails are registered.
  if (!owner) {
    throw new ApiError(401, 'Incorrect email or password. Please try again.');
  }

  const match = await bcrypt.compare(password, owner.password_hash);
  if (!match) {
    throw new ApiError(401, 'Incorrect email or password. Please try again.');
  }

  const token = signToken(owner);
  res.json({ token, account: toPublicOwner(owner) });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, shop_name, email, created_at FROM shop_owners WHERE id = $1',
    [req.shopOwnerId]
  );
  if (result.rows.length === 0) throw new ApiError(404, 'Account not found.');
  res.json({ account: toPublicOwner(result.rows[0]) });
});

module.exports = { register, login, me };
