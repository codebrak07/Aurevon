const { readData } = require('../data/db');

/**
 * Get all registered users for administration
 */
const getAllUsers = async (req, res) => {
  try {
    const data = await readData();
    
    // Map users to clean data (don't send everything if not needed, but for owner it's usually fine)
    const users = data.users.map(user => ({
      id: user.id,
      username: user.username || user.name,
      fullName: user.fullName || user.username || user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || user.image,
      likedSongsCount: (user.likedSongs || []).length,
      playlistsCount: (user.playlists || []).length,
      joinedAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : (user.id.includes('-') ? 'Legacy Account' : new Date(parseInt(user.id)).toLocaleDateString())
    }));

    res.json({
      total: users.length,
      users: users.reverse() // Newest first
    });
  } catch (error) {
    console.error('[Admin API] Failed to fetch users:', error);
    res.status(500).json({ message: 'Failed to retrieve user list', error: error.message });
  }
};

module.exports = {
  getAllUsers
};
