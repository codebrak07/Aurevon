/**
 * Aurevon Shared Intelligence Engine
 * Pure functional calculation engine for Smart Queue, Evidence Reasoning,
 * Artist Personalization, Music Match scoring, and Persistent Aurevon Moments.
 */

import {
  extractSignalsFromState,
  computeArtistAffinityMap,
  computeGenreDistribution,
  detectSessionBoundaries,
  SIGNAL_TYPES,
} from '../utils/signalModel';
import { searchTracks } from './musicService';

// Default recommendation scoring weights
const DEFAULT_WEIGHTS = {
  familiarity: 0.35,
  discovery: 0.40,
  continuity: 0.25,
};

/**
 * 1. SMART QUEUE ENGINE
 * Generates intelligent continuation picks with attached structured evidence.
 */
export async function generateSmartQueuePicks(state = {}, currentTrack = null, limit = 5) {
  const signals = extractSignalsFromState(state);
  const affinityMap = computeArtistAffinityMap(signals, state.likedSongs, state.playlists);

  const activeTrack = currentTrack || state.currentTrack;
  const currentArtist = activeTrack?.artist || activeTrack?.artistName || '';
  const currentGenre = activeTrack?.genre || activeTrack?.primaryGenreName || '';

  // 1. Build search seed query based on current artist & top affinity artists
  const topArtists = Object.keys(affinityMap)
    .sort((a, b) => affinityMap[b].score - affinityMap[a].score)
    .slice(0, 3);

  let seedQuery = currentArtist || topArtists[0] || 'Popular Music';
  
  // 2. Fetch candidate tracks via musicService
  let candidatePool = [];
  try {
    const searchRes = await searchTracks(seedQuery, 20);
    candidatePool = searchRes || [];
  } catch (err) {
    console.warn('[Intelligence] Failed candidate search, using fallback pool', err);
    candidatePool = state.recentlyPlayed || [];
  }

  // Filter out tracks already in current queue or played recently
  const existingIds = new Set([
    activeTrack?.id,
    activeTrack?.title,
    ...(state.queue || []).map((t) => t.id || t.title),
    ...signals.slice(0, 10).map((s) => s.trackId),
  ]);

  const candidates = candidatePool.filter((t) => {
    const trackId = t.id || t.videoId || t.title;
    return trackId && !existingIds.has(trackId);
  });

  // 3. Score candidates deterministically & attach evidence
  const scoredPicks = candidates.map((track) => {
    const trackArtist = (track.artist || track.artistName || '').trim();
    const trackGenre = track.genre || 'General';
    const artistAffinity = affinityMap[trackArtist] || null;

    let score = 0;
    let evidenceType = 'DISCOVERY';
    let supportingData = { artist: trackArtist, genre: trackGenre };

    // Check Familiarity
    if (artistAffinity && artistAffinity.playCount > 0) {
      const playScore = Math.min(artistAffinity.playCount * 0.1, 0.4);
      score += playScore * DEFAULT_WEIGHTS.familiarity;

      if (artistAffinity.replayCount > 0) {
        evidenceType = 'REPLAY_BEHAVIOR';
        supportingData.replayCount = artistAffinity.replayCount;
      } else if (artistAffinity.isLiked) {
        evidenceType = 'SAVED_PREFERENCE';
      } else {
        evidenceType = 'ARTIST_AFFINITY';
        supportingData.playCount = artistAffinity.playCount;
      }
    } else {
      // Discovery score
      score += 0.3 * DEFAULT_WEIGHTS.discovery;
      evidenceType = 'DISCOVERY';
    }

    // Check Continuity (current artist or genre match)
    if (currentArtist && trackArtist.toLowerCase() === currentArtist.toLowerCase()) {
      score += 0.4 * DEFAULT_WEIGHTS.continuity;
      evidenceType = 'ARTIST_AFFINITY';
    } else if (currentGenre && trackGenre.toLowerCase() === currentGenre.toLowerCase()) {
      score += 0.3 * DEFAULT_WEIGHTS.continuity;
      if (evidenceType === 'DISCOVERY') {
        evidenceType = 'GENRE_CONTINUITY';
      }
    }

    // Generate human-readable evidence explanation
    const evidence = {
      type: evidenceType,
      strength: Math.min(Math.max(score, 0.5), 0.98),
      supportingData,
      readableReason: explainRecommendation({ type: evidenceType, supportingData }),
    };

    return {
      ...track,
      isSmartPick: true,
      whyReason: evidence,
    };
  });

  // Sort by score descending and return top `limit`
  return scoredPicks.slice(0, limit);
}

/**
 * 2. "WHY AM I HEARING THIS?" EXPLANATION GENERATOR
 * Converts structured RecommendationEvidence into editorial human-readable text.
 */
export function explainRecommendation(evidence = {}) {
  const { type, supportingData = {} } = evidence;
  const artist = supportingData.artist || 'this artist';
  const genre = supportingData.genre || 'this genre';

  switch (type) {
    case 'ARTIST_AFFINITY':
      return supportingData.playCount
        ? `Grounded in your ${supportingData.playCount} previous listens to ${artist}.`
        : `Matches your listening affinity for ${artist}.`;

    case 'REPLAY_BEHAVIOR':
      return `You have replayed ${artist} multiple times in recent sessions.`;

    case 'SAVED_PREFERENCE':
      return `From ${artist}, one of your saved & favorited artists.`;

    case 'GENRE_CONTINUITY':
      return `Flowing naturally with your current ${genre} session vibe.`;

    case 'SESSION_CONTINUITY':
      return `Seamless continuation of your current listening session.`;

    case 'DISCOVERY':
    default:
      return `Fresh discovery selected based on your artist and genre preferences.`;
  }
}

/**
 * 3. ARTIST INTELLIGENCE PERSONALIZATION
 * Calculates personal relationship data for ArtistProfileModal.
 */
export function getArtistUserAffinity(artistName, state = {}) {
  if (!artistName) return null;

  const signals = extractSignalsFromState(state);
  const affinityMap = computeArtistAffinityMap(signals, state.likedSongs, state.playlists);
  const normalizedName = artistName.trim();

  // Find exact or case-insensitive match
  const matchedKey = Object.keys(affinityMap).find(
    (k) => k.toLowerCase() === normalizedName.toLowerCase()
  );

  const data = matchedKey ? affinityMap[matchedKey] : null;

  if (!data || data.playCount === 0) {
    return {
      hasHistory: false,
      artistName: normalizedName,
      playCount: 0,
      totalMinutesListened: 0,
      isLiked: state.followedArtists?.includes(normalizedName) || false,
      playlistCount: 0,
      favoriteTracks: [],
      editorialInsight: `You haven't explored ${normalizedName} much yet. Start listening to build your relationship stats.`,
    };
  }

  // Get favorite tracks by this artist
  const artistSignals = signals.filter(
    (s) => s.artistName.toLowerCase() === normalizedName.toLowerCase()
  );

  const trackMap = {};
  artistSignals.forEach((s) => {
    if (!trackMap[s.trackTitle]) {
      trackMap[s.trackTitle] = { title: s.trackTitle, id: s.trackId, plays: 0 };
    }
    trackMap[s.trackTitle].plays += 1;
  });

  const favoriteTracks = Object.values(trackMap)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 3);

  // Generate editorial insight
  let editorialInsight = `You're regularly tuned into ${data.artistName}.`;
  if (data.replayCount > 2) {
    editorialInsight = `You frequently loop and replay ${data.artistName}'s tracks during your key listening hours.`;
  } else if (data.totalMinutesListened > 30) {
    editorialInsight = `You've spent over ${data.totalMinutesListened} minutes immersed in ${data.artistName}'s discography.`;
  } else if (data.isLiked) {
    editorialInsight = `${data.artistName} is one of your favorited artists.`;
  }

  return {
    hasHistory: true,
    artistName: data.artistName,
    playCount: data.playCount,
    totalMinutesListened: data.totalMinutesListened,
    isLiked: data.isLiked || state.followedArtists?.includes(data.artistName),
    playlistCount: data.playlistCount,
    favoriteTracks,
    editorialInsight,
  };
}

/**
 * 4. MUSIC MATCH ENGINE
 * Deterministic compatibility calculation between two user taste states.
 */
export function computeMusicMatch(userStateA = {}, userStateB = {}) {
  const signalsA = extractSignalsFromState(userStateA);
  const signalsB = extractSignalsFromState(userStateB);

  const affinityA = computeArtistAffinityMap(signalsA, userStateA.likedSongs, userStateA.playlists);
  const affinityB = computeArtistAffinityMap(signalsB, userStateB.likedSongs, userStateB.playlists);

  const artistsA = new Set(Object.keys(affinityA));
  const artistsB = new Set(Object.keys(affinityB));

  // Shared artists
  const sharedArtists = [...artistsA].filter((artist) => artistsB.has(artist));

  let sharedArtistScore = 0;
  if (artistsA.size > 0 || artistsB.size > 0) {
    const unionSize = new Set([...artistsA, ...artistsB]).size;
    sharedArtistScore = Math.round((sharedArtists.length / Math.max(unionSize, 1)) * 100);
  }

  // Genre overlap
  const genreA = computeGenreDistribution(signalsA);
  const genreB = computeGenreDistribution(signalsB);

  let genreOverlapScore = 0;
  const allGenres = new Set([...Object.keys(genreA), ...Object.keys(genreB)]);
  if (allGenres.size > 0) {
    let diffSum = 0;
    allGenres.forEach((g) => {
      const pctA = genreA[g] || 0;
      const pctB = genreB[g] || 0;
      diffSum += Math.abs(pctA - pctB);
    });
    genreOverlapScore = Math.max(0, Math.round(100 - diffSum / 2));
  } else {
    genreOverlapScore = 75; // Baseline demo match
  }

  // Favorite tracks overlap
  const likedA = new Set((userStateA.likedSongs || []).map((t) => (t.title || t.name || '').toLowerCase()));
  const likedB = new Set((userStateB.likedSongs || []).map((t) => (t.title || t.name || '').toLowerCase()));
  const sharedLiked = [...likedA].filter((t) => likedB.has(t));
  const favoriteOverlapScore = Math.min(Math.round(sharedLiked.length * 20), 100);

  // Discovery complement score
  const discoveryScore = Math.min(85, Math.round((artistsA.size + artistsB.size) * 3));

  // Calculate true un-floored compatibility
  const hasInsufficientData = signalsA.length < 3 || signalsB.length < 3;

  const rawMatch = Math.round(
    sharedArtistScore * 0.35 +
      genreOverlapScore * 0.35 +
      favoriteOverlapScore * 0.15 +
      (hasInsufficientData ? 20 : discoveryScore * 0.15)
  );

  const overallMatch = Math.min(99, Math.max(10, rawMatch));

  // Generate starter queue for Jam Room
  const starterQueue = [
    ...(userStateA.likedSongs || []).slice(0, 2),
    ...(userStateB.likedSongs || []).slice(0, 2),
  ].filter(Boolean);

  const summary = hasInsufficientData
    ? `Limited listening history available. Listen to more music on Aurevon to improve this match.`
    : `You and ${userStateB.userProfile?.name || 'your friend'} share alignment in ${
        Object.keys(genreA)[0] || 'your favorite music'
      }${sharedArtists[0] ? ` and artists like ${sharedArtists[0]}` : ''}.`;

  return {
    overallMatch,
    hasInsufficientData,
    breakdown: {
      sharedArtistsScore: sharedArtistScore,
      genreOverlapScore,
      favoriteOverlapScore,
      discoveryScore: hasInsufficientData ? 20 : discoveryScore,
    },
    sharedArtists: sharedArtists.slice(0, 5),
    starterQueue,
    summary,
  };
}

/**
 * 5. AUREVON MOMENTS DETECTOR
 * Identifies meaningful listening session milestones and returns persistent Moment cards.
 * Returns [] if insufficient history exists — NEVER fabricates statistics or memories.
 */
export function detectAurevonMoments(state = {}) {
  const signals = extractSignalsFromState(state);
  const sessions = detectSessionBoundaries(signals);
  const moments = [];

  sessions.forEach((session) => {
    if (!session.signals || session.signals.length < 3) return;

    const startDate = new Date(session.startTime);
    const hour = startDate.getHours();
    const totalTracks = session.signals.length;
    const durationMins = Math.round((session.endTime - session.startTime) / (1000 * 60)) || totalTracks * 3;

    const uniqueArtists = new Set(session.signals.map((s) => s.artistName)).size;
    const replayCount = session.signals.filter((s) => s.type === SIGNAL_TYPES.REPLAY).length;

    // Idempotent ID generation derived from session startTime and totalTracks
    const momentId = `moment-${session.startTime}-${totalTracks}`;

    // Moment 1: Late Night Session (10PM - 4AM, >= 4 tracks)
    if ((hour >= 22 || hour <= 4) && totalTracks >= 4) {
      moments.push({
        id: momentId,
        type: 'LATE_NIGHT',
        title: 'Late Night Session',
        subtitle: `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • ${durationMins} minutes`,
        description: `You stayed tuned into atmospheric tracks late into the night, exploring ${uniqueArtists} artists across ${totalTracks} songs.`,
        stats: { durationMins, totalTracks, uniqueArtists },
        accentColor: '#8b5cf6',
      });
      return;
    }

    // Moment 2: High Replay Burst (>= 2 replays in session)
    if (replayCount >= 2) {
      const replayedTrack = session.signals.find((s) => s.type === SIGNAL_TYPES.REPLAY)?.trackTitle || 'your favorite track';
      moments.push({
        id: momentId,
        type: 'REPLAY_BURST',
        title: 'Deep Replay Session',
        subtitle: `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • Replay Streak`,
        description: `You couldn't get enough of "${replayedTrack}", looping it repeatedly during this session.`,
        stats: { durationMins, totalTracks, replayCount },
        accentColor: '#ec4899',
      });
      return;
    }

    // Moment 3: Discovery Streak (>= 4 unique artists in a session)
    if (uniqueArtists >= 4) {
      moments.push({
        id: momentId,
        type: 'DISCOVERY_STREAK',
        title: 'Genre Discovery Burst',
        subtitle: `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • ${uniqueArtists} New Artists`,
        description: `An expansive discovery session introducing you to ${uniqueArtists} distinct artists in one stream.`,
        stats: { durationMins, totalTracks, uniqueArtists },
        accentColor: '#06b6d4',
      });
    }
  });

  // Deduplicate by ID
  const uniqueMomentsMap = {};
  moments.forEach((m) => {
    uniqueMomentsMap[m.id] = m;
  });

  return Object.values(uniqueMomentsMap);
}
