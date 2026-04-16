require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const youtubeRoutes = require('./routes/youtubeRoutes');
const itunesRoutes = require('./routes/itunesRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

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

if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
