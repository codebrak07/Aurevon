// backend/controllers/youtubeController.js
const axios = require('axios');
const { getFromCache, setInCache, normalizeQuery } = require('../data/cache');

/**
 * Helper to calculate relevancy score for a YouTube search result
 */
const scoreVideo = (item, title, artist) => {
  const videoTitle = item.snippet.title.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerArtist = artist.toLowerCase();
  let score = 0;

  // 4. SMART MATCHING logic
  if (videoTitle.includes(lowerTitle)) score += 3;
  if (videoTitle.includes(lowerArtist)) score += 2;
  if (videoTitle.includes('official')) score += 2;
  if (videoTitle.includes('audio') || videoTitle.includes('lyrics')) score += 1;
  if (videoTitle.includes('remix') || videoTitle.includes('cover') || videoTitle.includes('live')) {
    score -= 2;
  }

  return score;
};

/**
 * Helper to clean YouTube titles and extract song names
 */
const cleanYouTubeTitle = (videoTitle) => {
  // 1. Remove specific tags and brackets
  let cleaned = videoTitle
    .replace(/\((Official Video|Official Music Video|Official Audio|HD|4K|Visualizer|Lyric Video|Music Video)\)/gi, '')
    .replace(/\[(Lyrics|HD|4K)\]/gi, '')
    .replace(/\b(HD|4K)\b/gi, '')
    .trim();

  // 2. Extract song name if "Artist - Song" format exists
  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    // Usually the song is the last part in "Artist - Song" or "Artist - Song (Tags)"
    cleaned = parts[parts.length - 1].trim();
  }

  return cleaned;
};

// Helper to get all available API keys from environment
const getApiKeys = () => {
  return [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_SECONDARY,
    process.env.YOUTUBE_API_KEY_THIRD
  ].filter(key => !!key); // Remove undefined/empty keys
};

// Internal function to call YouTube API with fallback logic
const fetchFromYouTube = async (params) => {
  const keys = getApiKeys();
  
  if (keys.length === 0) {
    throw new Error('No YouTube API keys configured');
  }

  let lastError;
  for (const key of keys) {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: { ...params, key }
      });
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const reason = error.response?.data?.error?.errors?.[0]?.reason;

      // API KEY FALLBACK LOGGING: Log which key failed (masking for safety)
      const maskedKey = key ? `${key.substring(0, 8)}...` : 'unknown key';
      console.log(`❌ Key failed: ${maskedKey} - ${reason || error.message}`);

      // If it's a quota error, try the next key
      if (status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')) {
        console.warn(`YouTube quota exceeded for current key, attempting next backup...`);
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }

  // If we reach here, all keys failed
  throw lastError;
};

const searchVideos = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query (q) is required' });
    }

    const normalizedQ = normalizeQuery(q);
    const cacheKey = `search:${normalizedQ}`;

    console.log("🧠 Checking cache for:", cacheKey);
    const cachedData = getFromCache(cacheKey);

    if (cachedData) {
      console.log("⚡ Serving from cache:", cacheKey);
      return res.json(cachedData);
    }

    console.log(`👉 Fetching from YouTube API: ${cacheKey}`);
    const data = await fetchFromYouTube({
      part: 'snippet',
      maxResults: 10,
      q: normalizedQ,
      type: 'video'
    });

    const videos = data.items
      .map(item => {
        const videoId = item.id?.videoId;
        if (!videoId) return null;

        return {
          id: videoId,
          title: item.snippet?.title,
          artist: item.snippet?.channelTitle?.trim(),
          thumbnail: item.snippet?.thumbnails?.high?.url,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube.com/embed/${videoId}`
        };
      })
      .filter(video => video !== null);

    await setInCache(cacheKey, videos);
    console.log("💾 Stored in cache:", cacheKey);

    res.json(videos);
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error('YouTube Search Error:', errorMessage);
    res.status(500).json({ message: 'Error fetching data from YouTube', error: errorMessage });
  }
};

/**
 * PRODUCTION-READY resolvePlayback
 * Resolves the best YouTube video for a track based on artist and title scoring.
 */
const resolvePlayback = async (req, res) => {
  const { title, artist } = req.query;

  // 1. INPUT VALIDATION
  if (!title || !artist) {
    return res.status(400).json({ message: 'Title and artist are required' });
  }

  // 3. YOUTUBE FETCH config
  const query = `${title} ${artist} official audio`;
  const normalizedQuery = normalizeQuery(query);
  const cacheKey = `resolve:${normalizedQuery}`;

  try {
    // 2. CACHE - Checking
    console.log("🧠 Checking cache:", cacheKey);
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log("⚡ Serving from cache:", cacheKey);
      return res.json(cachedData);
    }

    // 3. YOUTUBE FETCH - API Call
    console.log(`👉 Fetching from YouTube API for: ${query}`);
    const data = await fetchFromYouTube({
      part: 'snippet',
      maxResults: 5,
      q: query,
      type: 'video'
    });

    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ message: 'No search results found' });
    }

    // 4 & 5. SMART MATCHING & SAFETY
    const validMatches = data.items
      .map(item => ({
        item,
        score: scoreVideo(item, title, artist),
        videoId: item.id?.videoId
      }))
      .filter(match => match.videoId) // 5. Ensure videoId exists
      .sort((a, b) => b.score - a.score);

    if (validMatches.length === 0) {
      return res.status(404).json({ message: 'No valid video matches found' });
    }

    // Pick highest scoring video
    const bestMatch = validMatches[0].item;
    const videoId = bestMatch.id.videoId;

    // 6. RESPONSE FORMAT
    const result = {
      id: videoId,
      title: cleanYouTubeTitle(bestMatch.snippet.title),
      artist: artist, // Use the input artist as requested
      thumbnail: bestMatch.snippet.thumbnails?.high?.url || bestMatch.snippet.thumbnails?.default?.url,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`
    };

    // 2. CACHE - Storing
    await setInCache(cacheKey, result);
    console.log("💾 Stored in cache:", cacheKey);

    res.json(result);
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error('resolvePlayback Error:', errorMessage);
    res.status(500).json({ message: 'Error resolving playback', error: errorMessage });
  }
};

module.exports = {
  searchVideos,
  resolvePlayback
};
