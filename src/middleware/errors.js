// Wraps async route handlers so thrown errors / rejected promises
// are forwarded to Express's error handler instead of crashing the process.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Centralized error handler — keep this generic so we never leak
// stack traces or internal details to the client in production.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong. Please try again.' : err.message;
  res.status(status).json({ error: message });
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { asyncHandler, errorHandler, ApiError };
