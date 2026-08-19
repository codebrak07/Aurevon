/**
 * Aurevon Listening Signal Model
 * Normalizes raw listening history, recently played tracks, liked songs, and playlist entries
 * into structured ListeningSignals for pure functional consumption by intelligence tools.
 */

export const SIGNAL_TYPES = {
  PLAY: 'PLAY',
  SKIP: 'SKIP',
  REPLAY: 'REPLAY',
  LIKE: 'LIKE',
  SAVE: 'SAVE',
  PLAYLIST_ADD: 'PLAYLIST_ADD',
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
};

/**
 * Normalizes user state into a chronologically ordered array of ListeningSignals
 */
export function extractSignalsFromState(state = {}) {
  const {
    listeningHistory = [],
    recentlyPlayed = [],
    likedSongs = [],
  } = state;

  const signals = [];

  // Extract from listeningHistory
  listeningHistory.forEach((item, index) => {
    if (!item?.track) return;
    
    let type = SIGNAL_TYPES.PLAY;
    if (item.label === 'skipped_early') {
      type = SIGNAL_TYPES.SKIP;
    } else if (item.label === 'looped' || item.repeatCount > 1) {
      type = SIGNAL_TYPES.REPLAY;
    }

    const timestamp = item.timestamp ? new Date(item.timestamp).getTime() : (Date.now() - index * 180000);

    signals.push({
      id: `history-${index}-${item.track.id || item.track.title}`,
      type,
      timestamp,
      trackId: item.track.id || item.track.videoId || item.track.title,
      trackTitle: item.track.title || item.track.name,
      artistName: item.track.artist || item.track.artistName || 'Unknown Artist',
      genre: item.track.genre || item.track.primaryGenreName || 'General',
      durationWatched: item.durationWatched || item.position || 0,
      totalDuration: item.duration || item.track.duration || 180,
      label: item.label,
    });
  });

  // Fallback to recentlyPlayed if listeningHistory is short
  if (listeningHistory.length < 5 && recentlyPlayed.length > 0) {
    recentlyPlayed.forEach((track, index) => {
      if (!track) return;
      signals.push({
        id: `recent-${index}-${track.id || track.title}`,
        type: SIGNAL_TYPES.PLAY,
        timestamp: Date.now() - index * 300000,
        trackId: track.id || track.videoId || track.title,
        trackTitle: track.title || track.name,
        artistName: track.artist || track.artistName || 'Unknown Artist',
        genre: track.genre || 'General',
        durationWatched: 180,
        totalDuration: 180,
      });
    });
  }

  // Extract from likedSongs
  likedSongs.forEach((track, index) => {
    if (!track) return;
    signals.push({
      id: `like-${track.id || track.title || index}`,
      type: SIGNAL_TYPES.LIKE,
      timestamp: track.likedAt ? new Date(track.likedAt).getTime() : Date.now(),
      trackId: track.id || track.videoId || track.title,
      trackTitle: track.title || track.name,
      artistName: track.artist || track.artistName || 'Unknown Artist',
      genre: track.genre || 'General',
    });
  });

  // Sort chronologically (newest first)
  return signals.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Computes artist affinity stats (play count, listening minutes, saved status)
 */
export function computeArtistAffinityMap(signals = [], likedSongs = [], playlists = []) {
  const affinityMap = {};

  // Count plays, replays, skips, listening time per artist
  signals.forEach((signal) => {
    const artist = (signal.artistName || '').trim();
    if (!artist || artist === 'Unknown Artist') return;

    if (!affinityMap[artist]) {
      affinityMap[artist] = {
        artistName: artist,
        playCount: 0,
        replayCount: 0,
        skipCount: 0,
        totalSecondsListened: 0,
        uniqueTracks: new Set(),
        isLiked: false,
        playlistCount: 0,
      };
    }

    const entry = affinityMap[artist];
    entry.uniqueTracks.add(signal.trackId);

    if (signal.type === SIGNAL_TYPES.PLAY) {
      entry.playCount += 1;
      entry.totalSecondsListened += signal.durationWatched || 180;
    } else if (signal.type === SIGNAL_TYPES.REPLAY) {
      entry.playCount += 1;
      entry.replayCount += 1;
      entry.totalSecondsListened += (signal.totalDuration || 180) * 1.5;
    } else if (signal.type === SIGNAL_TYPES.SKIP) {
      entry.skipCount += 1;
      entry.totalSecondsListened += signal.durationWatched || 15;
    }
  });

  // Check liked status
  likedSongs.forEach((track) => {
    const artist = (track?.artist || track?.artistName || '').trim();
    if (artist && affinityMap[artist]) {
      affinityMap[artist].isLiked = true;
    }
  });

  // Check playlists presence
  playlists.forEach((pl) => {
    (pl.tracks || []).forEach((t) => {
      const artist = (t?.artist || t?.artistName || '').trim();
      if (artist && affinityMap[artist]) {
        affinityMap[artist].playlistCount += 1;
      }
    });
  });

  // Convert uniqueTracks Set to size
  Object.keys(affinityMap).forEach((artist) => {
    affinityMap[artist].uniqueTrackCount = affinityMap[artist].uniqueTracks.size;
    affinityMap[artist].totalMinutesListened = Math.round(affinityMap[artist].totalSecondsListened / 60);
    // Score calculation
    const e = affinityMap[artist];
    e.score = (e.playCount * 2) + (e.replayCount * 4) + (e.isLiked ? 10 : 0) + (e.playlistCount * 3) - (e.skipCount * 2);
  });

  return affinityMap;
}

/**
 * Computes genre distribution proportions
 */
export function computeGenreDistribution(signals = []) {
  const genreCounts = {};
  let total = 0;

  signals.forEach((sig) => {
    const genre = (sig.genre || 'General').trim();
    if (genre === 'General') return;
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    total += 1;
  });

  if (total === 0) return {};

  const distribution = {};
  Object.keys(genreCounts).forEach((g) => {
    distribution[g] = Math.round((genreCounts[g] / total) * 100);
  });

  return distribution;
}

/**
 * Groups signals into continuous listening sessions (gaps > 45 mins split sessions)
 */
export function detectSessionBoundaries(signals = []) {
  if (!signals.length) return [];

  // Sort ascending by timestamp for session grouping
  const sorted = [...signals].sort((a, b) => a.timestamp - b.timestamp);
  const sessions = [];
  let currentSession = null;

  sorted.forEach((sig) => {
    if (!currentSession) {
      currentSession = {
        id: `session-${sig.timestamp}`,
        startTime: sig.timestamp,
        endTime: sig.timestamp,
        signals: [sig],
      };
      return;
    }

    const gapMinutes = (sig.timestamp - currentSession.endTime) / (1000 * 60);
    if (gapMinutes <= 45) {
      currentSession.signals.push(sig);
      currentSession.endTime = sig.timestamp;
    } else {
      sessions.push(currentSession);
      currentSession = {
        id: `session-${sig.timestamp}`,
        startTime: sig.timestamp,
        endTime: sig.timestamp,
        signals: [sig],
      };
    }
  });

  if (currentSession) {
    sessions.push(currentSession);
  }

  return sessions.reverse(); // newest session first
}

/**
 * Single-pass unified summary object generator preventing redundant array iterations
 */
export function getSignalSummary(state = {}) {
  const signals = extractSignalsFromState(state);
  const affinityMap = computeArtistAffinityMap(signals, state.likedSongs, state.playlists);
  const genreDistribution = computeGenreDistribution(signals);
  const sessions = detectSessionBoundaries(signals);

  return {
    signals,
    affinityMap,
    genreDistribution,
    sessions,
  };
}

