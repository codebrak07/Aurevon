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

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret_key'
      );
      req.userId = decoded.userId;
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
  }

  const guestId = req.headers['x-guest-id'];
  if (guestId) {
    req.userId = guestId;
    return next();
  }

  return res.status(401).json({ message: 'No token or guest identity provided' });
};

module.exports = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
