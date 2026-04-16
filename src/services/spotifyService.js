import { mapITunesTrack, mapITunesArtist } from '../utils/mappers';
import cacheService from './cacheService';
import { searchVideoId } from './youtubeService';

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YT_API_KEYS = [
  import.meta.env.VITE_YOUTUBE_API_KEY,
  import.meta.env.VITE_YOUTUBE_API_KEY_SECONDARY
].filter(Boolean);
let currentYoutubeKeyIndex = 0;

// Fallback search using YouTube if iTunes fails somehow
async function fallbackSearch(query, signal) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '20',
    videoCategoryId: '10', // Music
  });

  let response = null;
  for (let i = 0; i < YT_API_KEYS.length; i++) {
    let attemptIndex = (currentYoutubeKeyIndex + i) % YT_API_KEYS.length;
    params.set('key', YT_API_KEYS[attemptIndex]);
    
    response = await fetch(`${YT_SEARCH_URL}?${params}`, { signal });
    if (response.ok) {
      currentYoutubeKeyIndex = attemptIndex;
      break;
    }
    if (response.status !== 403 && response.status !== 429) break;
    console.warn(`YouTube API key ${attemptIndex} failed (quota). Trying next...`);
  }

  if (!response || !response.ok) return [];
  
  const data = await response.json();
  return (data.items || []).map(item => ({
    id: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    album: 'YouTube Video',
    albumArt: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
    albumArtSmall: item.snippet.thumbnails.default?.url,
    duration: 0,
    spotifyId: '',
    artistId: '',
    isYouTubeFallback: true
  }));
}

export async function searchTracks(query, signal) {
  if (!query || query.trim().length < 2) return [];

  const cacheKey = `search_${query.trim().toLowerCase()}`;
  const cached = cacheService.get('search', cacheKey);
  if (cached && cached.length > 0) return cached;

  try {
    const params = new URLSearchParams({ term: query, entity: 'song', limit: '20' });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, { signal });

    if (!response.ok) throw new Error('iTunes search error');

    const data = await response.json();
    const tracks = (data.results || []).map(mapITunesTrack).filter(Boolean);
    
    if (tracks.length > 0) cacheService.set('search', cacheKey, tracks);
    return tracks;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    const fbResults = await fallbackSearch(query, signal);
    if (fbResults.length > 0) cacheService.set('search', cacheKey, fbResults);
    return fbResults;
  }
}

export async function searchArtists(query) {
  if (!query || query.trim().length < 2) return [];

  const cacheKey = `search_artist_${query.trim().toLowerCase()}`;
  const cached = cacheService.get('artistData', cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ term: query, entity: 'musicArtist', limit: '5' });
    const response = await fetch(`https://itunes.apple.com/search?${params}`);
    if (!response.ok) return [];

    const data = await response.json();
    const basicArtists = (data.results || []).map(mapITunesArtist).filter(Boolean);
    
    // For each artist, try to fetch their real image via getArtistFullData
    // We do this in parallel to keep it fast
    const artists = await Promise.all(
      basicArtists.map(async (ba) => {
        const fullData = await getArtistFullData(ba.id);
        return fullData || ba;
      })
    );
    
    if (artists.length > 0) cacheService.set('artistData', cacheKey, artists);
    return artists;
  } catch {
    return [];
  }
}

export async function getAudioFeatures(trackId) {
  // iTunes does not provide audio features like valence or danceability.
  // Returning null allows the app to gracefully degrade.
  return null;
}

export async function getArtistData(artistId) {
  if (!artistId) return null;
  const cached = cacheService.get('artistData', artistId);
  if (cached) return cached;

  try {
    const response = await fetch(`https://itunes.apple.com/lookup?id=${artistId}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      cacheService.set('artistData', artistId, data.results[0]);
      return data.results[0];
    }
    return null;
  } catch {
    return null;
  }
}

export async function getArtistTopTracks(artistId) {
  if (!artistId) return [];
  const cacheKey = `artist_top_tracks_${artistId}`;
  const cached = cacheService.get('artistData', cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ id: artistId, entity: 'song', limit: '10' });
    const response = await fetch(`https://itunes.apple.com/lookup?${params}`);
    if (!response.ok) return [];

    const data = await response.json();
    // The first result is the artist metadata, subsequent ones are the tracks
    const tracks = (data.results || []).slice(1).map(mapITunesTrack).filter(Boolean);
    
    if (tracks.length > 0) cacheService.set('artistData', cacheKey, tracks);
    return tracks;
  } catch {
    return [];
  }
}

export async function getArtistFullData(artistId) {
  if (!artistId) return null;
  
  try {
    // 1. Fetch artist basic info
    const artistRes = await fetch(`https://itunes.apple.com/lookup?id=${artistId}`);
    if (!artistRes.ok) return null;
    const artistData = await artistRes.json();
    const artist = artistData.results?.[0];
    if (!artist) return null;

    // 2. Fetch artist image from Deezer API to get a real artist picture, fallback to iTunes album
    let image = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.artistName)}&background=random&color=fff&size=512`;
    
    try {
      const deezerRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist.artistName)}&limit=1`);
      if (deezerRes.ok) {
        const deezerData = await deezerRes.json();
        if (deezerData.data && deezerData.data.length > 0 && deezerData.data[0].picture_xl) {
          image = deezerData.data[0].picture_xl;
        }
      }
    } catch (e) {
      console.warn("Deezer fetch failed, falling back to iTunes album art");
    }

    if (image.includes('ui-avatars')) {
      const albumRes = await fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=1`);
      if (albumRes.ok) {
        const albumData = await albumRes.json();
        const topAlbum = albumData.results?.find(r => r.wrapperType === 'collection');
        if (topAlbum?.artworkUrl100) {
          image = topAlbum.artworkUrl100.replace('100x100bb', '1000x1000bb');
        }
      }
    }

    return {
      id: String(artist.artistId),
      name: artist.artistName,
      genre: artist.primaryGenreName,
      type: 'artist',
      image: image
    };
  } catch (err) {
    console.error('Failed to get full artist data:', err);
    return null;
  }
}

export async function getRecommendations({
  seedTracks = [],
  seedArtists = [],
  seedGenres = [],
  targetValence,
  targetEnergy,
}) {
  const cacheKey = `recs_${[...seedTracks, ...seedArtists, ...seedGenres].join(',')}_v${targetValence}_e${targetEnergy}`;
  const cached = cacheService.get('recommendations', cacheKey);
  if (cached && cached.length > 0) return cached;

  // The AI provides descriptive recommendation strings. We use them for a broad iTunes lookup
  let query = [...seedTracks, ...seedArtists, ...seedGenres].join(' ');
  query = query.trim() || 'popular matching songs';

  try {
    const params = new URLSearchParams({ term: query, entity: 'song', limit: '20' });
    const response = await fetch(`https://itunes.apple.com/search?${params}`);
    if (!response.ok) return [];

    const data = await response.json();
    let tracks = (data.results || []).map(mapITunesTrack).filter(Boolean);
    
    // Simple shuffle to prevent identical repeated lists
    tracks = tracks.sort(() => 0.5 - Math.random());
    
    if (tracks.length > 0) cacheService.set('recommendations', cacheKey, tracks);
    return tracks;
  } catch {
    return [];
  }
}

export async function getArtistLatestTracks(artistName) {
  if (!artistName) return [];
  const cacheKey = `artist_latest_tracks_${artistName.toLowerCase()}`;
  const cached = cacheService.get('artistData', cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ term: artistName, entity: 'song', limit: '15', sort: 'recent' });
    const response = await fetch(`https://itunes.apple.com/search?${params}`);
    if (!response.ok) return [];

    const data = await response.json();
    const tracks = (data.results || [])
      .map(track => ({ ...mapITunesTrack(track), rawRating: track.userRatingCount || 0 }))
      .filter(t => t && t.artist.toLowerCase().includes(artistName.toLowerCase()))
      .sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    
    if (tracks.length > 0) cacheService.set('artistData', cacheKey, tracks);
    return tracks;
  } catch {
    return [];
  }
}
