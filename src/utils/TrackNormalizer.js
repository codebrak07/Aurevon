/**
 * TrackNormalizer.js
 * Centralized utility to normalize track metadata from different sources
 * into a single unified Track interface.
 */

// Helper to parse YouTube titles into Title and Artist
function parseYouTubeTitleAndArtist(rawTitle, channelTitle) {
  if (!rawTitle) return { title: '', artist: channelTitle };

  // Remove common YouTube clutter
  const cleanRaw = rawTitle
    .replace(/\[.*?\]/g, '') // Remove everything inside brackets [Official Music Video], [Lyrics], etc.
    .replace(/\(.*?\)/g, '') // Remove everything inside parenthesis (Official Video), (Audio)
    .replace(/\{.*?\}/g, '') // Remove curly braces
    .replace(/\|.*/, '') // Remove everything after a pipe |
    .trim();

  // Look for any hyphen-like separator (hyphen with spaces, en-dash, em-dash)
  // Standard hyphen '-' must have at least one space around it to prevent splitting words like Spider-Man or hip-hop.
  const separatorRegex = /\s+-\s*|\s*-\s+|\s*[–—]\s*/;
  if (separatorRegex.test(cleanRaw)) {
    const parts = cleanRaw.split(separatorRegex);
    if (parts.length >= 2) {
      const part0 = parts[0].trim();
      const part1 = parts.slice(1).join(' - ').trim();

      const chL = channelTitle.toLowerCase();
      // Remove common suffixes to perform a fuzzy match against channel title
      const cleanCh = chL.replace('vevo', '').replace('official', '').replace('music', '').replace('channel', '').trim();
      const p0L = part0.toLowerCase();
      const p1L = part1.toLowerCase();

      // Check if channel title is closer to part0 or part1
      const isP0Artist = cleanCh && (chL.includes(p0L) || p0L.includes(cleanCh));
      const isP1Artist = cleanCh && (chL.includes(p1L) || p1L.includes(cleanCh));

      if (isP0Artist && !isP1Artist) {
        return { title: part1, artist: part0 };
      } else if (isP1Artist && !isP0Artist) {
        return { title: part0, artist: part1 };
      } else {
        // Fallback: Default to Artist - Title format, so Title is the second part
        return { title: part1 || part0, artist: part0 || channelTitle };
      }
    }
  }

  return { title: cleanRaw, artist: channelTitle };
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
    
    // Better title extraction by separating artist and song name
    const parsed = parseYouTubeTitleAndArtist(rawTitle, channelTitle);

    return {
      ...baseTrack,
      id: videoId, // Use videoId as the unified ID
      title: parsed.title || rawTitle,
      artist: parsed.artist || channelTitle,
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
