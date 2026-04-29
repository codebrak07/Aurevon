// backend/controllers/itunesController.js
const axios = require('axios');

const searchSongs = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query (q) is required' });
    }

    const response = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: q,
        media: 'music',
        limit: 15,
        country: 'IN',
        lang: 'en_us',
        _t: Date.now()
      }
    });

    const songs = response.data.results.map(song => ({
      trackName: song.trackName,
      artistName: song.artistName,
      album: song.collectionName,
      thumbnail: song.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg'), // Higher resolution
      previewUrl: song.previewUrl
    }));

    res.json(songs);
  } catch (error) {
    console.error('iTunes Search Error:', error.message);
    res.status(500).json({ message: 'Error fetching data from iTunes', error: error.message });
  }
};

const getIndiaTop100 = async (req, res) => {
  try {
    const url = 'https://rss.marketingtools.apple.com/api/v2/in/music/most-played/100/songs.json';
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('iTunes Top 100 Error:', error.message);
    res.status(500).json({ message: 'Error fetching India Top 100', error: error.message });
  }
};

module.exports = {
  searchSongs,
  getIndiaTop100
};
