require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const youtubeRoutes = require('./routes/youtubeRoutes');
const itunesRoutes = require('./routes/itunesRoutes');
const sunoRoutes = require('./routes/sunoRoutes');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Middleware
app.use(cors());
app.use(express.json());

// 2. GLOBAL logger BEFORE all routes
app.use((req, res, next) => {
  console.log("🌍 Incoming request:", req.method, req.url);
  next();
});

// 3. Confirm this exists and is correct
// 17. Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/itunes', itunesRoutes);
app.use('/api/suno', sunoRoutes);

// iTunes Search Proxy (Helper)
app.get('/api/search/itunes', async (req, res) => {
  try {
    const { term, entity, limit } = req.query;
    const response = await axios.get('https://itunes.apple.com/search', {
      params: { term, entity, limit }
    });
    res.json(response.data);
  } catch (error) {
    console.error('iTunes Proxy Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch from iTunes' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Music Player API is running...');
});

// 6. Add fallback route at bottom (BEFORE error middleware)
app.use((req, res) => {
  console.log("❌ No route matched:", req.method, req.url);
  res.status(404).json({ message: "Route not found" });
});

// 4. Ensure it is placed BEFORE any error middleware
// 28. Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

module.exports = app;
