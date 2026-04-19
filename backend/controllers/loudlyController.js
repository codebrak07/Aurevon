const axios = require('axios');

const LOUDLY_BASE_URL = 'https://soundtracks.loudly.com/api';

/**
 * Generates music using Loudly's Text-to-Music API
 */
const generate = async (req, res) => {
  try {
    const { prompt, duration = 60, structure = 'Classic' } = req.body;
    const apiKey = process.env.SOUNDLY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Soundly API key is missing on the server' });
    }

    console.log('[LOUDLY PROXY] Generating with prompt:', prompt);

    const response = await axios.post(`${LOUDLY_BASE_URL}/ai/prompt/songs`, {
      prompt,
      duration: parseInt(duration),
      structure_id: structure
    }, {
      headers: {
        'API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Loudly returns { ai_song: { music_file_path: '...', ... } }
    res.json(response.data);
  } catch (error) {
    console.error('[LOUDLY PROXY] Generation error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      message: 'Failed to generate song via Loudly',
      error: error.response?.data || error.message
    });
  }
};

module.exports = {
  generate
};
