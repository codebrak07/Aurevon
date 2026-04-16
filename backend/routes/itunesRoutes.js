// backend/routes/itunesRoutes.js
const express = require('express');
const { searchSongs } = require('../controllers/itunesController');

const router = express.Router();

router.get('/search', searchSongs);

module.exports = router;
