export function mapSpotifyTrack(item) {
  if (!item) return null;
  return {
    id: item.id,
    title: item.name,
    artist: item.artists?.map((a) => a.name).join(', ') || 'Unknown Artist',
    artistId: item.artists?.[0]?.id || '',
    album: item.album?.name || '',
    albumArt:
      item.album?.images?.[0]?.url ||
      item.album?.images?.[1]?.url ||
      '',
    albumArtSmall:
      item.album?.images?.[2]?.url ||
      item.album?.images?.[1]?.url ||
      item.album?.images?.[0]?.url ||
      '',
    duration: item.duration_ms || 0,
    spotifyId: item.id,
    genres: item.artists?.[0]?.genres || [],
  };
}

export function mapITunesTrack(item) {
  if (!item) return null;
  const hqArtwork = item.artworkUrl100?.replace('100x100bb', '600x600bb') || '';
  const lowArtwork = item.artworkUrl100?.replace('100x100bb', '300x300bb') || '';

  // Detection for Hindi Artists to prevent auto-translation issues
  const HINDI_ARTISTS = [
    'arijit singh', 'pritam', 'shreya ghoshal', 'amit trivedi', 
    'vishal-shekhar', 'a.r. rahman', 'ar rahman', 'badshah', 
    'diljit dosanjh', 'jubin nautiyal', 'neha kakkar', 'sidhu moose wala',
    'ap dhillon', 'gurinder gill', 'shubh', 'king', 'raftaar', 'krsna',
    'darshan raval', 'armaan malik', 'amaal mallik', 'Atif Aslam', 'Mohit Chauhan'
  ];
  const isHindiArtist = HINDI_ARTISTS.some(a => (item.artistName || '').toLowerCase().includes(a.toLowerCase()));
  
  // Quality Filter: Reject fake AI/Impersonator tracks
  const VALID_HINDI_GENRES = ['bollywood', 'indian', 'pop', 'world', 'devotional', 'regional indian', 'playback'];
  const trackGenre = (item.primaryGenreName || '').toLowerCase();
  const isSuspiciousGenre = !VALID_HINDI_GENRES.some(g => trackGenre.includes(g)) && 
                          (trackGenre.includes('hip-hop') || trackGenre.includes('rap') || trackGenre.includes('electronic'));

  const SUSPICIOUS_COLLECTIONS = ['forever in your eyes', 'every moment feels like heaven', 'feels like heaven'];
  const isSuspiciousCollection = SUSPICIOUS_COLLECTIONS.some(c => (item.collectionName || '').toLowerCase().includes(c));

  if (isHindiArtist && (isSuspiciousGenre || isSuspiciousCollection)) {
    return null;
  }
  
  return {
    id: String(item.trackId),
    title: item.trackName || '',
    artist: item.artistName || 'Unknown Artist',
    artistId: String(item.artistId || ''),
    album: item.collectionName || '',
    albumArt: hqArtwork,
    albumArtSmall: lowArtwork,
    duration: item.trackTimeMillis || 0,
    spotifyId: String(item.trackId), // Store trackId in spotifyId so the app components don't break
    genres: item.primaryGenreName ? [item.primaryGenreName] : [],
    releaseDate: item.releaseDate || '',
    isHindiArtist: isHindiArtist,
    audioUrl: item.previewUrl || ''
  };
}

export function mapITunesArtist(item) {
  if (!item) return null;
  return {
    id: String(item.artistId),
    name: item.artistName || 'Unknown Artist',
    type: 'artist',
    genre: item.primaryGenreName || '',
    artistLink: item.artistLinkUrl || '',
    image: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.artistName)}&background=random&color=fff&size=512` // Fallback since iTunes doesn't provide artist images directly in search
  };
}

export function mapYouTubeResult(item) {
  if (!item) return null;
  return {
    videoId: typeof item.id === 'object' ? item.id.videoId : item.id,
    title: item.snippet?.title || '',
    thumbnail: item.snippet?.thumbnails?.default?.url || '',
    channelTitle: item.snippet?.channelTitle || '',
  };
}

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(ms) {
  if (!ms) return '0:00';
  return formatTime(ms / 1000);
}
