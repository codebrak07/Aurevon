const express = require('express');
const router = express.Router();
const { 
    createRoom, 
    joinRoom, 
    addSong, 
    voteSkip, 
    play, 
    pause,
    heartbeat,
    getRoom
} = require('../controllers/jamController');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');

// Jam rooms support authenticated users and guest listeners.
router.use(optionalAuthMiddleware);

router.post('/create', createRoom);
router.post('/join', joinRoom);
router.get('/:roomId', getRoom);
router.post('/:roomId/queue', addSong);
router.post('/:roomId/vote_skip', voteSkip);
router.post('/:roomId/heartbeat', heartbeat);

// Host actions
router.post('/:roomId/play', play);
router.post('/:roomId/pause', pause);

module.exports = router;
