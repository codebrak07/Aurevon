const axios = require('axios');

const SUNO_BASE_URL = 'https://api.aimlapi.com/v1/suno';

/**
 * Helper to call AIMLAPI with primary/secondary key fallback
 */
async function callSunoAPI(method, endpoint, data = null) {
  const primaryKey = process.env.SUNO_API_KEY;
  const secondaryKey = process.env.SUNO_API_KEY_SECONDARY;

  const makeRequest = async (key) => {
    return axios({
      method,
      url: `${SUNO_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      data
    });
  };

  try {
    return await makeRequest(primaryKey);
  } catch (error) {
    // If primary fails with Auth or Quota errors, try secondary
    if ((error.response?.status === 401 || error.response?.status === 429 || error.response?.status === 403) && secondaryKey) {
      console.log('[SUNO PROXY] Primary key failed, trying fallback...');
      return await makeRequest(secondaryKey);
    }
    throw error;
  }
}

const generate = async (req, res) => {
  try {
    const { prompt, tags, title, make_instrumental } = req.body;
    
    const response = await callSunoAPI('post', '/submit/music', {
      mv: 'chirp-v3-5',
      prompt,
      tags,
      title,
      make_instrumental: !!make_instrumental,
      continue_at: null,
      continue_clip_id: null
    });

    res.json(response.data);
  } catch (error) {
    console.error('[SUNO PROXY] Generate error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      message: 'Failed to generate song via Suno',
      error: error.response?.data || error.message
    });
  }
};

const getFeed = async (req, res) => {
  try {
    const { ids } = req.params;
    const response = await callSunoAPI('get', `/feed/${ids}`);
    res.json(response.data);
  } catch (error) {
    console.error('[SUNO PROXY] Feed error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      message: 'Failed to fetch Suno feed',
      error: error.response?.data || error.message
    });
  }
};

module.exports = {
  generate,
  getFeed
};
