const express = require('express');
const router = express.Router();
const { createShareLink, getShareLink } = require('../controllers/shareController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route to resolve links
router.get('/:shareId', getShareLink);

// Protected route to create links
router.post('/', authMiddleware, createShareLink);

module.exports = router;
