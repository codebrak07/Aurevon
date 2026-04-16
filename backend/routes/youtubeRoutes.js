// backend/routes/youtubeRoutes.js
const express = require('express');
const { searchVideos, resolvePlayback } = require('../controllers/youtubeController');

const router = express.Router();

router.get('/search', searchVideos);

router.get('/resolve', resolvePlayback);

module.exports = router;
