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
