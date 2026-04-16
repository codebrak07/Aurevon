const { readData, writeData } = require('../data/db');

/**
 * Get full user profile
 */
const getProfile = async (req, res) => {
  try {
    const data = await readData();
    const user = data.users.find(u => u.id === req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * First-time sync/merge of localStorage data
 */
const syncData = async (req, res) => {
  try {
    const { likedSongs, followedArtists, playlists, recentlyPlayed } = req.body;
    const data = await readData();
    const userIndex = data.users.findIndex(u => u.id === req.userId);
    if (userIndex === -1) return res.status(404).json({ message: 'User not found' });

    const user = data.users[userIndex];

    // Smart Merge
    user.likedSongs = Array.from(new Set([...(user.likedSongs || []), ...(likedSongs || [])].map(s => JSON.stringify(s)))).map(s => JSON.parse(s));
    user.followedArtists = Array.from(new Set([...(user.followedArtists || []), ...(followedArtists || [])]));
    user.recentlyPlayed = (recentlyPlayed || []).slice(0, 20); // Keep only latest 20

    // Merge playlists by name
    const existingPlaylistNames = (user.playlists || []).map(p => p.name);
    (playlists || []).forEach(p => {
      if (!existingPlaylistNames.includes(p.name)) {
        user.playlists.push(p);
      }
    });

    data.users[userIndex] = user;
    await writeData(data);

    res.json({ message: 'Sync successful', user });
  } catch (error) {
    res.status(500).json({ message: 'Sync failed', error: error.message });
  }
};

/**
 * Incremental update (PATCH) for specific fields
 */
const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const data = await readData();
    const userIndex = data.users.findIndex(u => u.id === req.userId);
    if (userIndex === -1) return res.status(404).json({ message: 'User not found' });

    // Apply allowed updates only
    const allowedFields = ['likedSongs', 'followedArtists', 'playlists', 'recentlyPlayed', 'preferences', 'username', 'avatarUrl', 'email', 'dob', 'fullName', 'gender'];
    Object.keys(updates).forEach(field => {
      if (allowedFields.includes(field)) {
        data.users[userIndex][field] = updates[field];
      }
    });

    await writeData(data);
    res.json({ message: 'Update successful', user: data.users[userIndex] });
  } catch (error) {
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
};

module.exports = {
  getProfile,
  syncData,
  updateProfile
};
