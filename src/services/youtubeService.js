import { mapYouTubeResult } from '../utils/mappers';
import cacheService from './cacheService';

const KEYS = [
  import.meta.env.VITE_YOUTUBE_API_KEY,
  import.meta.env.VITE_YOUTUBE_API_KEY_SECONDARY,
  import.meta.env.VITE_YOUTUBE_API_KEY_TERTIARY,
  import.meta.env.VITE_YOUTUBE_API_KEY_4,
  import.meta.env.VITE_YOUTUBE_API_KEY_5,
  import.meta.env.VITE_YOUTUBE_API_KEY_6,
  // Base64 Backups
  atob('QUl6YVN5Qkx0Y0RBVDR3cEllX09EazEtelNGWjFmd0E3TVBiQmhn'),
  atob('QUl6YVN5QjYtLXVJMExXRWE2SGZmWTVkZXVFUVlBaDB6TWI0M1U4'),
  atob('QUl6YVN5RHRDUG9tX2ZhWDF4Q1JtWktrTFVORmw3Wkl4VERVSTlj'),
  atob('QUl6YVN5QmFheFVLQVNiYWc1SlBmVkhNMS14V0h4eTIySVFBeHV3'),
  atob('QUl6YVN5QlhTb2JZT3pBUlJQM0Qzb0hxN2hQcDNNWUktRTh1QmtB'),
  atob('QUl6YVN5Q3pCZi1NcmhuRnVkcXRFNDRRWFpPQ3J3STlDWVk1bDJF')
].filter(Boolean);

// Deduplicate keys
const UNIQUE_KEYS = [...new Set(KEYS)];

let currentKeyIndex = 0;

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

async function fetchWithFallback(url, params) {
  let response = null;
  for (let i = 0; i < UNIQUE_KEYS.length; i++) {
    let attemptIndex = (currentKeyIndex + i) % UNIQUE_KEYS.length;
    params.set('key', UNIQUE_KEYS[attemptIndex]);
    
    try {
      response = await fetch(`${url}?${params}`);
      if (response.ok) {
        currentKeyIndex = attemptIndex;
        return response;
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.warn(`[YouTube API] Key ${attemptIndex} failed with status ${response.status}:`, errorData.error?.message || 'Unknown error');
      
      // If it's not a quota or auth error, don't bother trying other keys
      if (response.status !== 403 && response.status !== 429) {
        return response;
      }
    } catch (err) {
      console.error(`[YouTube API] Fetch error with key ${attemptIndex}:`, err);
    }
  }
  return response;
}

function scoreResult(item, trackTitle, artistName) {
  const title = (item.snippet?.title || '').toLowerCase();
  const channel = (item.snippet?.channelTitle || '').toLowerCase();
  const track = trackTitle.toLowerCase();
  const artist = artistName.toLowerCase();

  let score = 0;

  // Positive signals
  if (title.includes(track)) score += 30;
  if (title.includes(artist) || channel.includes(artist)) score += 25;
  if (title.includes('official')) score += 15;
  if (title.includes('audio')) score += 15;
  if (title.includes('official audio')) score += 10;
  if (channel.includes('topic')) score += 10;
  if (title.includes('lyrics')) score += 5;
  if (channel.includes('vevo')) score += 10;

  // Negative signals
  if (title.includes('live')) score -= 20;
  if (title.includes('cover')) score -= 25;
  if (title.includes('remix')) score -= 15;
  if (title.includes('karaoke')) score -= 30;
  if (title.includes('tutorial')) score -= 30;
  if (title.includes('reaction')) score -= 30;
  if (title.includes('slowed')) score -= 15;
  if (title.includes('reverb')) score -= 10;
  if (title.includes('nightcore')) score -= 15;
  if (title.includes('8d')) score -= 10;
  if (title.includes('hour')) score -= 20;

  return score;
}

export async function searchVideoId(trackTitle, artistName, trackId) {
  if (!trackTitle) return null;

  // Check cache first
  if (trackId) {
    const cached = cacheService.get('videoMap', trackId);
    if (cached) return { videoId: cached, title: 'Cached' };
  }

  const cleanTitle = trackTitle.replace(/[^\w\s]/gi, '').trim();
  const cleanArtist = artistName ? artistName.replace(/[^\w\s]/gi, '').trim() : '';
  
  // Strategy 1: Specific
  const queries = [
    `${cleanTitle} ${cleanArtist} official audio`,
    `${cleanTitle} ${cleanArtist}`,
    `${trackTitle}`,
    `${cleanTitle.split(' ')[0]} music video` // Absolute last resort: first word of title
  ];

  let items = [];
  let bestTitle = null;

  for (const q of queries) {
    console.log(`[YouTube Search] Trying query: "${q}"`);
    const params = new URLSearchParams({
      part: 'snippet',
      q: q,
      type: 'video',
      maxResults: '5',
      videoCategoryId: '10', // Music
    });

    const response = await fetchWithFallback(SEARCH_URL, params);
    if (response?.ok) {
      const data = await response.json();
      items = data?.items || [];
      if (items.length > 0) break;
    }
    
    // If specific music category failed, try without it
    params.delete('videoCategoryId');
    const fallbackResponse = await fetchWithFallback(SEARCH_URL, params);
    if (fallbackResponse?.ok) {
      const data = await fallbackResponse.json();
      items = data?.items || [];
      if (items.length > 0) break;
    }
  }

  if (items.length === 0) {
    console.error(`[YouTube Search] All queries failed for: ${trackTitle}`);
    return null;
  }

  // Smart matching: score all results, pick the best
  const scored = items.map((item) => ({
    ...item,
    score: scoreResult(item, trackTitle, artistName),
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const mapped = mapYouTubeResult(best);

  if (mapped?.videoId && trackId) {
    cacheService.set('videoMap', trackId, mapped.videoId);
  }

  return { 
    videoId: mapped?.videoId || null, 
    title: best?.snippet?.title || null 
  };
}

export async function getRelatedVideos(videoId, trackTitle, artistName) {
  if (!trackTitle && !artistName) return [];
  const query = artistName ? `${artistName} music` : `${trackTitle} similar songs`;
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '10',
    videoCategoryId: '10',
  });

  try {
    const response = await fetchWithFallback(SEARCH_URL, params);
    if (!response?.ok) return [];
    const data = await response.json();
    return (data.items || []).map(mapYouTubeResult).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getTrendingSongs() {
  const cacheKey = 'trending_songs_2025';
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    part: 'snippet',
    q: 'trending music 2025 top songs this week',
    type: 'video',
    maxResults: '10',
    videoCategoryId: '10',
  });

  try {
    const response = await fetchWithFallback(SEARCH_URL, params);
    if (!response?.ok) return [];
    const data = await response.json();
    const results = (data.items || []).map(mapYouTubeResult).filter(Boolean);
    cacheService.set('aiSuggestions', cacheKey, results); 
    return results;
  } catch {
    return [];
  }
}

export async function getArtistLatestReleases(artistName) {
  if (!artistName) return [];
  const cacheKey = `latest_release:${artistName.toLowerCase()}`;
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    part: 'snippet',
    q: `${artistName} new song 2025 official music video`,
    type: 'video',
    order: 'date',
    maxResults: '2',
    videoCategoryId: '10',
  });

  try {
    const response = await fetchWithFallback(SEARCH_URL, params);
    if (!response?.ok) return [];
    const data = await response.json();
    const results = (data.items || []).map(mapYouTubeResult).filter(Boolean);
    cacheService.set('aiSuggestions', cacheKey, results);
    return results;
  } catch {
    return [];
  }
}
