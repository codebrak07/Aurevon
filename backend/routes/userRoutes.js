const express = require('express');
const { getProfile, syncData, updateProfile } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profile', authMiddleware, getProfile);
router.post('/sync', authMiddleware, syncData);
router.patch('/update', authMiddleware, updateProfile);

module.exports = router;
