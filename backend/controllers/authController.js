const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { readData, writeData } = require('../data/db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── AUTHORED EMAILS ONLY ──
// Removed restriction to allow any Google account for development.
const WHITELIST_EMAILS = []; 

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const data = await readData();

    if (data.users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      followedArtists: [],
      likedSongs: [],
      playlists: [],
      recentlyPlayed: [],
      preferences: {},
      createdAt: new Date().toISOString()
    };

    data.users.push(newUser);
    await writeData(data);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await readData();

    const user = data.users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        followedArtists: user.followedArtists || [],
        likedSongs: user.likedSongs || [],
        playlists: user.playlists || [],
        recentlyPlayed: user.recentlyPlayed || []
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: avatarUrl } = payload;

    // Whitelist check removed for development

    const data = await readData();
    const normalizedEmail = email.toLowerCase().trim();
    let user = data.users.find(u => u.email.toLowerCase().trim() === normalizedEmail || u.googleId === googleId);

    if (!user) {
      // Create new user if not exists
      user = {
        id: uuidv4(),
        googleId,
        username: name,
        email: normalizedEmail,
        avatarUrl,
        followedArtists: [],
        likedSongs: [],
        playlists: [],
        recentlyPlayed: [],
        preferences: {},
        createdAt: new Date().toISOString()
      };
      data.users.push(user);
      await writeData(data);
    } else {
      // Periodic sync: Always update username and avatar on Google login if they exist
      // This ensures if they change their Google name, it reflects in our DB
      let changed = false;
      if (user.username !== name) { user.username = name; changed = true; }
      if (user.avatarUrl !== avatarUrl) { user.avatarUrl = avatarUrl; changed = true; }
      if (!user.googleId) { user.googleId = googleId; changed = true; }
      if (!user.createdAt) { user.createdAt = new Date().toISOString(); changed = true; }
      
      if (changed) {
        await writeData(data);
      }
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        followedArtists: user.followedArtists || [],
        likedSongs: user.likedSongs || [],
        playlists: user.playlists || [],
        recentlyPlayed: user.recentlyPlayed || []
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Google login failed', error: error.message });
  }
};

module.exports = {
  signup,
  login,
  googleLogin
};
