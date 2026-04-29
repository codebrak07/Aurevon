require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const youtubeRoutes = require('./routes/youtubeRoutes');
const itunesRoutes = require('./routes/itunesRoutes');
const sunoRoutes = require('./routes/sunoRoutes');
const loudlyRoutes = require('./routes/loudlyRoutes');
const aiRoutes = require('./routes/aiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const axios = require('axios');

const app = express();
const PORT = 5001; // Force 5001 for local development

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Middleware
app.use(cors({ origin: true, credentials: true })); 
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
app.use('/api/loudly', loudlyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/jam', require('./routes/jamRoutes'));
app.use('/api/share', require('./routes/shareRoutes'));

// iTunes Search Proxy (Helper)
app.get('/api/search/itunes', async (req, res) => {
  try {
    const { term, entity, limit, country = 'IN', lang = 'en_us' } = req.query;
    console.log(`🔍 iTunes Proxy: Searching for "${term}" [${entity}] in ${country}/${lang}`);
    
    const response = await axios.get('https://itunes.apple.com/search', {
      params: { term, entity, limit, country, lang, _t: Date.now() },
      timeout: 5000
    });
    
    console.log(`✅ iTunes Proxy: Found ${response.data.results?.length || 0} results`);
    res.json(response.data);
  } catch (error) {
    console.error('❌ iTunes Proxy Error:', error.message);
    if (error.response) {
      console.error('Data:', error.response.data);
    }
    res.status(500).json({ error: 'Failed to fetch from iTunes', details: error.message });
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
