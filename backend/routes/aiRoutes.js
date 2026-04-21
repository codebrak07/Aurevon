const express = require('express');
const { refinePrompt, getRecommendations, smartShuffle, magicSeeds, magicVibeV2 } = require('../controllers/aiController');

const router = express.Router();

router.post('/refine', refinePrompt);
router.post('/recommendations', getRecommendations);
router.post('/shuffle', smartShuffle);
router.post('/magic-seeds', magicSeeds);
router.post('/magic-vibe-v2', magicVibeV2);

module.exports = router;
