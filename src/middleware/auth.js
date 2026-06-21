const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

/**
 * Protects routes by requiring a valid JWT in the Authorization header.
 * On success, attaches req.shopOwnerId so every downstream query can be
 * scoped to the logged-in shop owner only.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.shopOwnerId = payload.sub;
    req.shopOwnerEmail = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = { requireAuth };
