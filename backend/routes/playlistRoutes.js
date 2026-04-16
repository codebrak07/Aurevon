const express = require('express');
const { getPlaylists, createPlaylist, addSongToPlaylist, deletePlaylist } = require('../controllers/playlistController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getPlaylists);
router.post('/', createPlaylist);
router.post('/:id/add', addSongToPlaylist);
router.delete('/:id', deletePlaylist);

module.exports = router;
