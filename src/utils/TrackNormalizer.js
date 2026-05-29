/**
 * TrackNormalizer.js
 * Centralized utility to normalize track metadata from different sources
 * into a single unified Track interface.
 */

// Helper to clean YouTube titles
function sanitizeYouTubeTitle(title) {
  if (!title) return '';
  return title
    .replace(/\[.*?\]/g, '') // Remove everything inside brackets [Official Music Video], [Lyrics], etc.
    .replace(/\(.*?\)/g, '') // Remove everything inside parenthesis (Official Video), (Audio)
    .replace(/\{.*?\}/g, '') // Remove curly braces
    .replace(/\|.*/, '') // Remove everything after a pipe |
    .replace(/-.*/, '') // Frequently used as "Artist - Title", but we just want the first part or clean up
    .trim();
}

function parseYouTubeDuration(duration) {
  // Simplistic ISO 8601 duration parser (e.g., PT3M45S -> 225000 ms)
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
}

export function normalizeTrack(rawItem, source) {
  if (!rawItem) return null;

  const baseTrack = {
    id: '',
    title: '',
    artist: 'Unknown Artist',
    artistId: '',
    album: '',
    albumArt: '',
    albumArtSmall: '',
    duration: 0,
    spotifyId: '',
    videoId: '', // Explicit field for YouTube playback identity
    isYouTubeFallback: false,
    source: source, // 'itunes' | 'youtube' | 'spotify'
    genres: [],
    releaseDate: '',
    audioUrl: ''
  };

  if (source === 'itunes') {
    const item = rawItem;
    const hqArtwork = item.artworkUrl100?.replace('100x100bb', '600x600bb') || '';
    const lowArtwork = item.artworkUrl100?.replace('100x100bb', '300x300bb') || '';
    
    return {
      ...baseTrack,
      id: String(item.trackId),
      title: item.trackName || '',
      artist: item.artistName || 'Unknown Artist',
      artistId: String(item.artistId || ''),
      album: item.collectionName || '',
      albumArt: hqArtwork,
      albumArtSmall: lowArtwork,
      duration: item.trackTimeMillis || 0,
      spotifyId: String(item.trackId),
      isYouTubeFallback: false,
      genres: item.primaryGenreName ? [item.primaryGenreName] : [],
      releaseDate: item.releaseDate || '',
      audioUrl: '' // Never use iTunes previewUrl — it's always a 30s clip. Full playback goes via YouTube.
    };
  }

  if (source === 'youtube') {
    const item = rawItem;
    const videoId = typeof item.id === 'object' ? item.id.videoId : item.id;
    const rawTitle = item.snippet?.title || '';
    const channelTitle = item.snippet?.channelTitle || '';
    
    // Better title extraction if channel name is part of the title
    let cleanTitle = sanitizeYouTubeTitle(rawTitle);
    if (!cleanTitle) cleanTitle = rawTitle; // Fallback if regex stripped everything

    return {
      ...baseTrack,
      id: videoId, // Use videoId as the unified ID
      title: cleanTitle,
      artist: channelTitle, // Using channel title as artist
      album: 'YouTube',
      albumArt: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
      albumArtSmall: item.snippet?.thumbnails?.default?.url || '',
      duration: item.contentDetails?.duration ? parseYouTubeDuration(item.contentDetails.duration) : 0,
      spotifyId: videoId,
      videoId: videoId, // Preserve exact videoId
      isYouTubeFallback: true
    };
  }

  return baseTrack;
}

export function normalizeArtist(rawItem, source) {
  if (!rawItem) return null;

  if (source === 'itunes') {
    const item = rawItem;
    return {
      id: String(item.artistId),
      name: item.artistName || 'Unknown Artist',
      type: 'artist',
      genre: item.primaryGenreName || '',
      artistLink: item.artistLinkUrl || '',
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.artistName)}&background=random&color=fff&size=512`
    };
  }

  return null;
}
