const express = require('express');
const { refinePrompt, getRecommendations, smartShuffle, magicSeeds } = require('../controllers/aiController');

const router = express.Router();

router.post('/refine', refinePrompt);
router.post('/recommendations', getRecommendations);
router.post('/shuffle', smartShuffle);
router.post('/magic-seeds', magicSeeds);

module.exports = router;
