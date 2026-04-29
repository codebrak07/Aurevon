const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret_key'
    );
    // Standardize to req.userId for consistency across controllers
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const optionalAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const guestId = req.headers['x-guest-id'];

  // 1. Try JWT authentication first
  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret_key'
      );
      req.userId = decoded.userId;
      return next();
    } catch (error) {
      // JWT failed — but don't hard-fail yet.
      // If there's also a guest ID, use that as fallback.
      console.warn(`[Auth] JWT verification failed: ${error.message}. Checking guest ID fallback.`);
      if (guestId) {
        req.userId = guestId;
        return next();
      }
      // No fallback available
      return res.status(401).json({ message: 'Token is not valid and no guest ID provided' });
    }
  }

  // 2. Guest ID authentication
  if (guestId) {
    req.userId = guestId;
    return next();
  }

  return res.status(401).json({ message: 'No token or guest identity provided' });
};

module.exports = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
