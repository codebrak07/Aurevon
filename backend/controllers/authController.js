const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { readData, writeData } = require('../data/db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
      preferences: {}
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

    const data = await readData();
    let user = data.users.find(u => u.email === email || u.googleId === googleId);

    if (!user) {
      // Create new user if not exists
      user = {
        id: uuidv4(),
        googleId,
        username: name,
        email,
        avatarUrl,
        followedArtists: [],
        likedSongs: [],
        playlists: [],
        recentlyPlayed: [],
        preferences: {}
      };
      data.users.push(user);
      await writeData(data);
    } else if (!user.googleId) {
      // Link existing email account with Google
      user.googleId = googleId;
      user.avatarUrl = avatarUrl;
      await writeData(data);
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
