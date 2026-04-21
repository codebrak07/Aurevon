const { readData } = require('../data/db');

/**
 * Middleware to restrict access to only the authorized Admin email.
 * This runs AFTER authMiddleware (so req.userId is available).
 */
const adminMiddleware = async (req, res, next) => {
  try {
    const data = await readData();
    const user = data.users.find(u => u.id === req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const adminEmails = ['aalekhforapple@gmail.com', 'aalekhmaheshwari@gmail.com', process.env.ADMIN_EMAIL]
      .filter(Boolean)
      .map(e => e.toLowerCase().trim());

    if (!adminEmails.includes(user.email.toLowerCase().trim())) {
      console.warn(`[Security] Unauthorized admin access attempt by: ${user.email}`);
      return res.status(403).json({ message: 'Access denied: Admin privileges required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Admin verification failed', error: error.message });
  }
};

module.exports = adminMiddleware;
