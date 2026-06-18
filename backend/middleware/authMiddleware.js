const jwt = require('jsonwebtoken');
const { admin } = require('../config/firebase-admin');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // 1. Try Firebase Admin verification first
  if (admin && admin.apps && admin.apps.length > 0) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.userId = decodedToken.uid;
      return next();
    } catch (error) {
      console.warn('[Auth Middleware] Firebase verification failed, falling back to local JWT check:', error.message);
    }
  }

  // 2. Fallback to local JWT check (for development/testing mock modes)
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret_key'
    );
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const guestId = req.headers['x-guest-id'];

  // 1. Try Firebase/JWT verification if token is present
  if (token) {
    if (admin && admin.apps && admin.apps.length > 0) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.userId = decodedToken.uid;
        return next();
      } catch (error) {
        console.warn('[Auth Middleware] Optional Firebase verification failed, checking JWT fallback...');
      }
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret_key'
      );
      req.userId = decoded.userId;
      return next();
    } catch (error) {
      console.warn(`[Auth] JWT verification failed: ${error.message}. Checking guest ID fallback.`);
    }
  }

  // 2. Guest ID fallback
  if (guestId) {
    req.userId = guestId;
    return next();
  }

  return res.status(401).json({ message: 'No token or guest identity provided' });
};

module.exports = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
