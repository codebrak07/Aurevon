const axios = require('axios');
const fs = require('fs').promises;
console.log('✅ globalChartController loaded');
const path = require('path');
const { callGemini } = require('./aiController');

const CACHE_FILE = path.join(__dirname, '../data/globalChartsCache.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const COUNTRIES = {
  'us': { name: 'USA', flag: '🇺🇸', lang: 'English' },
  'gb': { name: 'UK', flag: '🇬🇧', lang: 'English' },
  'es': { name: 'Spain', flag: '🇪🇸', lang: 'Spanish' },
  'mx': { name: 'Mexico', flag: '🇲🇽', lang: 'Spanish' },
  'ru': { name: 'Russia', flag: '🇷🇺', lang: 'Russian' },
  'fr': { name: 'France', flag: '🇫🇷', lang: 'French' },
  'jp': { name: 'Japan', flag: '🇯🇵', lang: 'J-Pop' },
  'kr': { name: 'S. Korea', flag: '🇰🇷', lang: 'K-Pop' },
  'in': { name: 'India', flag: '🇮🇳', lang: 'Indian' },
  'br': { name: 'Brazil', flag: '🇧🇷', lang: 'Portuguese' }
};

const getGlobalDashboard = async (req, res) => {
  try {
    // Check Cache
    try {
      const stats = await fs.stat(CACHE_FILE);
      if (Date.now() - stats.mtimeMs < CACHE_DURATION) {
        const cachedContent = await fs.readFile(CACHE_FILE, 'utf-8');
        return res.json(JSON.parse(cachedContent));
      }
    } catch (err) {
      // Cache doesn't exist, proceed
    }

    // Parallel Fetch from Apple Music RSS
    const fetchPromises = Object.keys(COUNTRIES).map(code => 
      axios.get(`https://rss.applemarketingtools.com/api/v2/${code}/music/most-played/100/songs.json`)
        .then(res => ({ code, data: res.data.feed.results }))
        .catch(err => {
          console.error(`[GlobalChart] Failed to fetch ${code}:`, err.message);
          return { code, data: [] };
        })
    );

    const results = await Promise.all(fetchPromises);
    
    // Aggregator & Mapper
    const allTracks = [];
    const trackMap = new Map();

    results.forEach(({ code, data }) => {
      data.forEach((item, index) => {
        const countryInfo = COUNTRIES[code];
        const trackId = item.id;
        
        if (!trackMap.has(trackId)) {
          const track = {
            id: `apple-${trackId}`,
            appleId: trackId,
            title: item.name,
            artist: item.artistName,
            albumArt: item.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg'),
            albumArtSmall: item.artworkUrl100,
            url: item.url,
            genres: item.genres.map(g => g.name),
            countries: [countryInfo.flag],
            languages: [countryInfo.lang],
            maxRank: index + 1,
            isNew: false, // In a real app, compare with previous cache
            source: 'apple-music'
          };
          trackMap.set(trackId, track);
          allTracks.push(track);
        } else {
          const existing = trackMap.get(trackId);
          if (!existing.countries.includes(countryInfo.flag)) {
            existing.countries.push(countryInfo.flag);
          }
          if (!existing.languages.includes(countryInfo.lang)) {
            existing.languages.push(countryInfo.lang);
          }
          if (index + 1 < existing.maxRank) {
            existing.maxRank = index + 1;
          }
        }
      });
    });

    // Sort by popularity (number of countries appearing in + rank)
    allTracks.sort((a, b) => {
      if (b.countries.length !== a.countries.length) {
        return b.countries.length - a.countries.length;
      }
      return a.maxRank - b.maxRank;
    });

    // AI Classification for Vibes (Top 100 hits for better filter coverage)
    const viralHits = allTracks.slice(0, 100);
    const vibePrompt = `Assign exactly ONE Gen Z vibe tag to each song using the IDs provided.
    IDs: heartbreak, gym, soft-life, sigma, villain-arc, late-night, party-mode, study-mode, romantic, toxic.
    Songs: [ ${viralHits.map(t => `"${t.title} - ${t.artist}"`).join(', ')} ]
    Return ONLY a JSON object: { "Song Name - Artist Name": "id", ... }`;

    try {
      const classifications = await callGemini(vibePrompt);
      viralHits.forEach(track => {
        const key = `${track.title} - ${track.artist}`;
        track.vibe = classifications[key] || 'late night'; // Default vibe
      });
    } catch (err) {
      console.warn('[GlobalChart] AI Classification failed:', err.message);
      // Fallback vibe tags based on genre (using SLUGS)
      viralHits.forEach(track => {
        if (!track.vibe) {
          const g = track.genres.join(' ').toLowerCase();
          if (g.includes('pop') || g.includes('dance')) track.vibe = 'party-mode';
          else if (g.includes('hip-hop') || g.includes('rap')) track.vibe = 'sigma';
          else if (g.includes('lo-fi') || g.includes('chill')) track.vibe = 'late-night';
          else if (g.includes('r&b') || g.includes('soul')) track.vibe = 'soft-life';
          else track.vibe = 'late-night'; 
        } else {
          // Normalize AI response just in case
          track.vibe = track.vibe.toLowerCase().replace(/\s+/g, '-');
        }
      });
    }

    const payload = {
      lastUpdated: new Date().toISOString(),
      trending: viralHits.slice(0, 10),
      allTracks: allTracks
    };

    // Save to Cache
    await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2));

    res.json(payload);
  } catch (error) {
    console.error('[GlobalChart] Dashboard Error:', error.message);
    res.status(500).json({ message: 'Error generating global dashboard', error: error.message });
  }
};

module.exports = {
  getGlobalDashboard
};
