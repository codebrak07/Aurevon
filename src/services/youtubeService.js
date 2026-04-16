import { mapYouTubeResult } from '../utils/mappers';
import cacheService from './cacheService';

const KEYS = [
  import.meta.env.VITE_YOUTUBE_API_KEY,
  import.meta.env.VITE_YOUTUBE_API_KEY_SECONDARY,
  import.meta.env.VITE_YOUTUBE_API_KEY_TERTIARY,
  'AIzaSyBLtcDAT4wpIe_ODk1-zSFZ1fwA7MPbBhg',
  'AIzaSyB6--uI0LWEa6HffY5deuEQYAh0zMb43U8',
  'AIzaSyDtCPom_faX1xCRmZKkLUNFl7ZIxTDUI9c',
  'AIzaSyBaaxUKASbag5JPfVHM1-xWHxy22IQAxuw',
  'AIzaSyBXSobYOzARRP0D3oHq7hQp3MYI-E8uBkA',
  'AIzaSyCzBf-MrhnFudqtE44QXZOCrwI9CZY5l2E'
].filter(Boolean);

let currentKeyIndex = 0;

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

async function fetchWithFallback(url, params) {
  let response = null;
  for (let i = 0; i < KEYS.length; i++) {
    let attemptIndex = (currentKeyIndex + i) % KEYS.length;
    params.set('key', KEYS[attemptIndex]);
    
    response = await fetch(`${url}?${params}`);
    if (response.ok) {
      currentKeyIndex = attemptIndex;
      break;
    }
    if (response.status !== 403 && response.status !== 429) break;
    console.warn(`YouTube API quota exceeded for key ${attemptIndex}. Trying next...`);
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
    if (cached) return cached;
  }

  // Clean track title: replace emojis and trim
  const cleanTitle = trackTitle.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{1FAB0}-\u{1FABF}\u{1FAC0}-\u{1FACF}\u{1FAD0}-\u{1FADF}\u{1FAE0}-\u{1FAEF}\u{1FAF0}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  const cleanArtist = artistName ? artistName.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{1FAB0}-\u{1FABF}\u{1FAC0}-\u{1FACF}\u{1FAD0}-\u{1FADF}\u{1FAE0}-\u{1FAEF}\u{1FAF0}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') : '';
  
  let query = `${cleanTitle} ${cleanArtist} official audio`.trim();
  let params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '5',
    videoCategoryId: '10', // Music category
  });

  let response = await fetchWithFallback(SEARCH_URL, params);
  let data;
  if (response.ok) {
    data = await response.json();
  } else if (response.status !== 403 && response.status !== 429) {
    throw new Error(`YouTube search failed: ${response.status}`);
  }

  let items = data?.items || [];

  // Fallback 1: Broad search without "official audio" and NO category restriction
  if (items.length === 0) {
    query = `${cleanTitle} ${cleanArtist}`.trim();
    params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: '5',
    });
    response = await fetchWithFallback(SEARCH_URL, params);
    if (response.ok) {
      data = await response.json();
      items = data?.items || [];
    }
  }

  // Fallback 2: Just search the exact raw trackTitle incase it was heavily filtered
  if (items.length === 0) {
    query = `${trackTitle}`.trim();
    params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: '3',
    });
    response = await fetchWithFallback(SEARCH_URL, params);
    if (response.ok) {
      data = await response.json();
      items = data?.items || [];
    }
  }

  if (items.length === 0) return null;

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

  return mapped?.videoId || null;
}

/**
 * Find related music videos by searching for similar content.
 * (YouTube deprecated `relatedToVideoId` — this uses search instead)
 */
export async function getRelatedVideos(videoId, trackTitle, artistName) {
  if (!trackTitle && !artistName) return [];

  // Search for similar music by the same artist or genre
  const query = artistName
    ? `${artistName} music`
    : `${trackTitle} similar songs`;

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '10',
    videoCategoryId: '10', // Music
  });

  try {
    const response = await fetchWithFallback(SEARCH_URL, params);
    if (!response.ok) return [];

    const data = await response.json();
    return (data.items || []).map(mapYouTubeResult).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Fetch 5 trending music videos.
 */
export async function getTrendingSongs() {
  const cacheKey = 'trending_songs_2025';
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    part: 'snippet',
    q: 'trending music 2025 top songs this week',
    type: 'video',
    maxResults: '5',
    videoCategoryId: '10', // Music
  });

  try {
    const response = await fetchWithFallback(SEARCH_URL, params);
    if (!response.ok) return [];
    const data = await response.json();
    const results = (data.items || []).map(mapYouTubeResult).filter(Boolean);
    
    // Cache for 12 hours
    cacheService.set('aiSuggestions', cacheKey, results); 
    return results;
  } catch {
    return [];
  }
}

/**
 * Fetch 1-2 latest music videos for a specific artist.
 */
export async function getArtistLatestReleases(artistName) {
  if (!artistName) return [];

  const cacheKey = `latest_release:${artistName.toLowerCase()}`;
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    part: 'snippet',
    q: `${artistName} new song 2025 official music video`,
    type: 'video',
    order: 'date', // Prioritize newest
    maxResults: '2',
    videoCategoryId: '10', // Music
  });

  try {
    const response = await fetchWithFallback(SEARCH_URL, params);
    if (!response.ok) return [];
    const data = await response.json();
    const results = (data.items || []).map(mapYouTubeResult).filter(Boolean);

    // Cache for 12 hours
    cacheService.set('aiSuggestions', cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

