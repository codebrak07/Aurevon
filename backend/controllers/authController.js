const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../data/db');
const axios = require('axios');


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
    if (!idToken) {
      return res.status(400).json({ message: 'Missing Google ID token' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('[Auth] GOOGLE_CLIENT_ID is not configured in backend .env');
      return res.status(500).json({ message: 'Backend configuration error: Google Client ID is missing' });
    }

    console.log('[Auth] Attempting to verify Google ID token via direct fetch...');
    
    // Direct verification via Google's tokeninfo endpoint
    // This avoids the 'Could not load default credentials' error from the library
    let payload;
    try {
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      payload = response.data;
      
      if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        console.error('[Auth] Token audience mismatch');
        return res.status(401).json({ message: 'Invalid token audience' });
      }
      console.log('[Auth] Google ID token verified successfully via API');
    } catch (verifyError) {
      console.error('[Auth] Direct verification failed:', verifyError.response?.data || verifyError.message);
      return res.status(401).json({ message: 'Failed to verify Google token' });
    }
    if (!payload?.email) {
      return res.status(400).json({ message: 'Google account did not provide an email address' });
    }

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
        fullName: name,
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
      if (user.fullName !== name) { user.fullName = name; changed = true; }
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
        fullName: user.fullName || user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        followedArtists: user.followedArtists || [],
        likedSongs: user.likedSongs || [],
        playlists: user.playlists || [],
        recentlyPlayed: user.recentlyPlayed || []
      }
    });
  } catch (error) {
    console.error('[Auth] Google login failed:', error);
    res.status(500).json({ 
      message: 'Google login failed', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};

module.exports = {
  signup,
  login,
  googleLogin
};
