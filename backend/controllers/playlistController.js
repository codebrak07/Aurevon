const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../data/db');

const getPlaylists = async (req, res) => {
  try {
    const data = await readData();
    const userPlaylists = data.playlists.filter(p => p.userId === req.user.userId);
    res.json(userPlaylists);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createPlaylist = async (req, res) => {
  try {
    const { name } = req.body;
    const data = await readData();

    const newPlaylist = {
      id: uuidv4(),
      name,
      userId: req.user.userId,
      songs: []
    };

    data.playlists.push(newPlaylist);
    await writeData(data);

    res.status(201).json(newPlaylist);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const addSongToPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist, youtubeId, thumbnail } = req.body;
    const data = await readData();

    const playlist = data.playlists.find(p => p.id === id && p.userId === req.user.userId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    const newSong = { title, artist, youtubeId, thumbnail };
    playlist.songs.push(newSong);

    await writeData(data);
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deletePlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readData();

    const playlistIndex = data.playlists.findIndex(p => p.id === id && p.userId === req.user.userId);
    if (playlistIndex === -1) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    data.playlists.splice(playlistIndex, 1);
    await writeData(data);

    res.json({ message: 'Playlist deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getPlaylists,
  createPlaylist,
  addSongToPlaylist,
  deletePlaylist
};
