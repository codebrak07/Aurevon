const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

/**
 * All routes in this folder are protected by Auth AND Admin privilege
 */
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', adminController.getAllUsers);

module.exports = router;
