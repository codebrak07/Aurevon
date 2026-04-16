import { createContext, useReducer, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { searchVideoId, getRelatedVideos } from '../services/youtubeService';
import { generateSmartShuffle, getSmartRecommendations, generateMagicSeeds } from '../services/aiService';
import { searchTracks, getArtistFullData, searchArtists } from '../services/spotifyService';
import { BASE_URL } from '../config/constants';

export const PlayerContext = createContext(null);

const MAX_RECENT_TRACKS = 10;
const MAX_HISTORY_ITEMS = 100;
const AI_QUEUE_THRESHOLD = 2; // Trigger AI when queue has ≤2 remaining tracks

function loadListeningHistory() {
  try {
    const saved = localStorage.getItem('wavify_listening_history');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadPlaylists() {
  try {
    const saved = localStorage.getItem('wavify_playlists');
    return saved ? JSON.parse(saved) : [{ id: '1', name: 'My Favorites', tracks: [] }];
  } catch {
    return [{ id: '1', name: 'My Favorites', tracks: [] }];
  }
}

// Load liked songs from localStorage
function loadLikedSongs() {
  try {
    const saved = localStorage.getItem('wavify_liked_songs');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Load user profile from localStorage
function loadUserProfile() {
  try {
    const saved = localStorage.getItem('wavify_user_profile');
    return saved ? JSON.parse(saved) : { 
      name: '', 
      fullName: '', 
      image: null, 
      email: '', 
      dob: '', 
      gender: '',
      preferences: { queuingMode: 'ai' }
    };
  } catch {
    return { 
      name: '', 
      fullName: '', 
      image: null, 
      email: '', 
      dob: '', 
      gender: '', 
      preferences: { queuingMode: 'ai' }
    };
  }
}

// Load followed artists from localStorage
function loadFollowedArtists() {
  try {
    const saved = localStorage.getItem('wavify_followed_artists');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// ── Session Mood Tracker ──
function computeSessionMood(listeningHistory, recentTracks) {
  const recentGenres = [];
  recentTracks.forEach(t => {
    if (t.genre) recentGenres.push(t.genre);
  });

  const totalPlays = listeningHistory.length;
  const skips = listeningHistory.filter(h => h.label === 'skipped_early').length;
  const skipRate = totalPlays > 0 ? Math.round((skips / totalPlays) * 100) : 0;

  // Estimate energy based on skip behavior and time
  let avgEnergy = 'medium';
  const fullListens = listeningHistory.filter(h => h.label === 'listened_fully' || h.label === 'looped').length;
  if (fullListens > totalPlays * 0.7) avgEnergy = 'high';
  else if (skips > totalPlays * 0.5) avgEnergy = 'low';

  return {
    recentGenres: [...new Set(recentGenres)].slice(0, 5),
    skipRate,
    avgEnergy,
  };
}

const API_BASE = BASE_URL;

const axiosInstance = axios.create({
  baseURL: API_BASE,
});

function loadToken() {
  return localStorage.getItem('wavify_token');
}

function loadSyncQueue() {
  try {
    const saved = localStorage.getItem('wavify_sync_queue');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

const initialState = {
  currentTrack: null,
  videoId: null,
  isPlaying: false,
  queue: [],
  currentIndex: -1,
  loopEnabled: false,
  volume: 80,
  recommendations: [],
  recsUiText: '',
  recsMood: '',
  recsEnergy: '',
  recsReason: '',
  recentTracks: [],
  listeningHistory: loadListeningHistory(),
  repeatTrack: null,
  repeatCount: 0,
  duration: 0,
  currentTime: 0,
  isLoading: false,
  recsLoading: false,
  userInteracted: false,
  playerReady: false,
  shuffleEnabled: false,
  shuffledIndices: [],
  likedSongs: loadLikedSongs(),
  magicLoading: false,
  magicError: null,
  aiShuffleLoading: false,
  playlists: loadPlaylists(),
  userProfile: loadUserProfile(),
  followedArtists: loadFollowedArtists(),
  user: null,
  token: loadToken(),
  isSyncing: false,
  syncQueue: loadSyncQueue(),
  errors: {
    search: null,
    playback: null,
    recommendations: null,
    ai: null,
  },
  selectedArtist: null,
  artistProfileOpen: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TRACK':
      return {
        ...state,
        currentTrack: action.payload.track,
        videoId: action.payload.videoId,
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        isLoading: false,
        errors: { ...state.errors, playback: null },
      };
    case 'SET_QUEUE_AND_INDEX':
      return {
        ...state,
        queue: action.payload.queue,
        currentIndex: action.payload.index,
      };
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LOOP':
      return { ...state, loopEnabled: !state.loopEnabled };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_RECOMMENDATIONS':
      return {
        ...state,
        recommendations: action.payload.tracks || action.payload,
        recsUiText: action.payload.uiText || state.recsUiText,
        recsMood: action.payload.mood || state.recsMood,
        recsEnergy: action.payload.energy || state.recsEnergy,
        recsReason: action.payload.reason || state.recsReason,
        recsLoading: false,
      };
    case 'SET_RECS_LOADING':
      return { ...state, recsLoading: action.payload };
    case 'SET_SHUFFLE':
      return { ...state, shuffleEnabled: !state.shuffleEnabled };
    case 'SET_SHUFFLED_INDICES':
      return { ...state, shuffledIndices: action.payload };
    case 'SET_USER_INTERACTED':
      return { ...state, userInteracted: true };
    case 'SET_PLAYER_READY':
      return { ...state, playerReady: true };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.type]: action.payload.message },
        isLoading: action.payload.type === 'playback' ? false : state.isLoading,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload]: null },
      };
    case 'ADD_TO_QUEUE': {
      const exists = state.queue.some(t => t.id === action.payload.id);
      if (exists) return state;
      return { ...state, queue: [...state.queue, action.payload] };
    }
    case 'ADD_MULTIPLE_TO_QUEUE': {
      const newTracks = action.payload.filter(t => !state.queue.some(q => q.id === t.id));
      if (newTracks.length === 0) return state;
      return { ...state, queue: [...state.queue, ...newTracks] };
    }
    case 'REMOVE_FROM_QUEUE': {
      const newQueue = state.queue.filter((_, i) => i !== action.payload);
      let newIndex = state.currentIndex;
      if (action.payload < state.currentIndex) newIndex--;
      else if (action.payload === state.currentIndex)
        newIndex = Math.min(newIndex, newQueue.length - 1);
      return { ...state, queue: newQueue, currentIndex: newIndex };
    }
    case 'TOGGLE_LIKE': {
      const exists = state.likedSongs.some(s => s.id === action.payload.id);
      const likedSongs = exists
        ? state.likedSongs.filter(s => s.id !== action.payload.id)
        : [...state.likedSongs, action.payload];
      return { ...state, likedSongs };
    }
    case 'CREATE_PLAYLIST': {
      return { ...state, playlists: [...state.playlists, action.payload] };
    }
    case 'ADD_TO_PLAYLIST': {
      const { playlistId, track } = action.payload;
      const newPlaylists = state.playlists.map(p => {
        if (p.id === playlistId) {
          if (!p.tracks.some(t => t.id === track.id)) {
            return { ...p, tracks: [...p.tracks, track] };
          }
        }
        return p;
      });
      return { ...state, playlists: newPlaylists };
    }
    case 'DELETE_PLAYLIST': {
      return { ...state, playlists: state.playlists.filter(p => p.id !== action.payload) };
    }
    case 'TRACK_PLAYED': {
      const track = action.payload;
      const filtered = state.recentTracks.filter(t => t.id !== track.id);
      const recentTracks = [track, ...filtered].slice(0, MAX_RECENT_TRACKS);
      const isSameTrack = state.repeatTrack?.id === track.id;
      return {
        ...state,
        recentTracks,
        repeatTrack: track,
        repeatCount: isSameTrack ? state.repeatCount + 1 : 1,
      };
    }
    case 'RECORD_BEHAVIOR': {
      const newHistory = [action.payload, ...state.listeningHistory].slice(0, MAX_HISTORY_ITEMS);
      return { ...state, listeningHistory: newHistory };
    }
    case 'CLEAR_QUEUE': {
      return { ...state, queue: [], currentIndex: -1 };
    }
    case 'SET_MAGIC_LOADING':
      return { ...state, magicLoading: action.payload };
    case 'SET_MAGIC_ERROR':
      return { ...state, magicError: action.payload };
    case 'SET_AI_SHUFFLE_LOADING':
      return { ...state, aiShuffleLoading: action.payload };
    case 'UPDATE_USER_PROFILE': {
      const newUserProfile = { ...state.userProfile, ...action.payload };
      try {
        localStorage.setItem('wavify_user_profile', JSON.stringify(newUserProfile));
      } catch { /* ignore storage errors */ }
      
      // If we are logged in, this will be picked up by the background sync logic
      // but we can also trigger a sync here for better reactivity
      return { 
        ...state, 
        userProfile: newUserProfile,
        // Also update the 'user' object if it exists to keep everything in sync
        user: state.user ? { ...state.user, ...newUserProfile } : state.user
      };
    }
    case 'TOGGLE_FOLLOW_ARTIST': {
      const artistName = action.payload;
      const exists = state.followedArtists.includes(artistName);
      const followedArtists = exists
        ? state.followedArtists.filter(a => a !== artistName)
        : [...state.followedArtists, artistName];
      return { ...state, followedArtists };
    }
    case 'AUTH_SUCCESS':
      return { 
        ...state, 
        user: action.payload.user, 
        token: action.payload.token,
        likedSongs: action.payload.user.likedSongs || state.likedSongs,
        followedArtists: action.payload.user.followedArtists || state.followedArtists,
        playlists: action.payload.user.playlists || state.playlists,
        recentlyPlayed: action.payload.user.recentlyPlayed || state.recentlyPlayed
      };
    case 'AUTH_LOGOUT':
      return { 
        ...state, 
        user: null, 
        token: null,
        likedSongs: loadLikedSongs(),
        followedArtists: loadFollowedArtists(),
        playlists: loadPlaylists()
      };
    case 'SET_SYNCING':
      return { ...state, isSyncing: action.payload };
    case 'ADD_TO_SYNC_QUEUE':
      return { ...state, syncQueue: [...state.syncQueue, action.payload] };
    case 'CLEAR_SYNC_QUEUE':
      return { ...state, syncQueue: [] };
    case 'UPDATE_FULL_USER_DATA':
      return {
        ...state,
        likedSongs: action.payload.likedSongs || state.likedSongs,
        followedArtists: action.payload.followedArtists || state.followedArtists,
        playlists: action.payload.playlists || state.playlists,
        recentlyPlayed: action.payload.recentlyPlayed || state.recentlyPlayed
      };
    case 'SET_SELECTED_ARTIST':
      return { ...state, selectedArtist: action.payload };
    case 'SET_ARTIST_PROFILE_OPEN':
      return { ...state, artistProfileOpen: action.payload };
    default:
      return state;
  }
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const playerRef = useRef(null);
  const timeUpdateRef = useRef(null);
  const prefetchedRef = useRef(null);
  const stateRef = useRef(state);
  const aiShuffleInFlightRef = useRef(false);

  // Keep stateRef current
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Persist liked songs
  useEffect(() => {
    try {
      localStorage.setItem('wavify_liked_songs', JSON.stringify(state.likedSongs));
    } catch { /* storage full */ }
  }, [state.likedSongs]);

  // Persist playlists
  useEffect(() => {
    try {
      localStorage.setItem('wavify_playlists', JSON.stringify(state.playlists));
    } catch { /* storage full */ }
  }, [state.playlists]);

  // Persist listening history
  useEffect(() => {
    try {
      localStorage.setItem('wavify_listening_history', JSON.stringify(state.listeningHistory));
    } catch { /* storage full */ }
  }, [state.listeningHistory]);

  // Persist followed artists
  useEffect(() => {
    try {
      localStorage.setItem('wavify_followed_artists', JSON.stringify(state.followedArtists));
    } catch { /* storage full */ }
  }, [state.followedArtists]);

  // Persist token
  useEffect(() => {
    if (state.token) {
      localStorage.setItem('wavify_token', state.token);
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
    } else {
      localStorage.removeItem('wavify_token');
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  }, [state.token]);

  // Persist sync queue
  useEffect(() => {
    localStorage.setItem('wavify_sync_queue', JSON.stringify(state.syncQueue));
  }, [state.syncQueue]);

  // Background Sync Processor
  useEffect(() => {
    if (state.token && state.syncQueue.length > 0 && !state.isSyncing) {
      processSyncQueue();
    }
  }, [state.token, state.syncQueue, state.isSyncing]);

  const processSyncQueue = async () => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    const queue = [...state.syncQueue];
    
    // Simple strategy: consolidate into a single update of the latest state
    const update = {
      likedSongs: state.likedSongs,
      followedArtists: state.followedArtists,
      playlists: state.playlists,
      recentlyPlayed: state.recentlyPlayed,
    };

    try {
      await axiosInstance.patch('/user/update', update);
      dispatch({ type: 'CLEAR_SYNC_QUEUE' });
    } catch (err) {
      console.warn('[Sync] Failed to background sync:', err);
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  };

  const syncToBackend = useCallback(() => {
    if (stateRef.current.token) {
      dispatch({ type: 'ADD_TO_SYNC_QUEUE', payload: Date.now() });
    }
  }, []);

  // Fetch profile on mount if token exists
  useEffect(() => {
    if (state.token) {
      const fetchProfile = async () => {
        try {
          const res = await axiosInstance.get('/user/profile');
          dispatch({ type: 'AUTH_SUCCESS', payload: { user: res.data, token: state.token } });
        } catch (err) {
          if (err.response?.status === 401) {
            dispatch({ type: 'AUTH_LOGOUT' });
          }
        }
      };
      fetchProfile();
    }
  }, []); // eslint-disable-line

  const loginWithGoogle = async (idToken) => {
    dispatch({ type: 'SET_MAGIC_LOADING', payload: true });
    try {
      const res = await axiosInstance.post('/auth/google', { idToken });
      const { token, user } = res.data;

      // Smart Merge logic
      const localData = {
        likedSongs: loadLikedSongs(),
        followedArtists: loadFollowedArtists(),
        playlists: loadPlaylists(),
      };

      // Perform initial sync/merge
      const mergeRes = await axios.post(`${API_BASE}/user/sync`, localData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      dispatch({ type: 'AUTH_SUCCESS', payload: { token, user: mergeRes.data.user } });
    } catch (err) {
      console.error('Google login failed:', err);
      throw err;
    } finally {
      dispatch({ type: 'SET_MAGIC_LOADING', payload: false });
    }
  };

  const logout = () => {
    dispatch({ type: 'AUTH_LOGOUT' });
  };

  const setPlayerRef = useCallback((player) => {
    playerRef.current = player;
  }, []);

  const setUserInteracted = useCallback(() => {
    dispatch({ type: 'SET_USER_INTERACTED' });
  }, []);

  const setPlayerReady = useCallback(() => {
    dispatch({ type: 'SET_PLAYER_READY' });
  }, []);

  const getNextTrackIndex = useCallback((currentIdx, qLength, shuffle, shuffledInds) => {
    if (shuffle && shuffledInds.length > 0) {
      const currentPos = shuffledInds.indexOf(currentIdx);
      if (currentPos !== -1 && currentPos < shuffledInds.length - 1) {
        return shuffledInds[currentPos + 1];
      }
      return -1;
    }
    return currentIdx < qLength - 1 ? currentIdx + 1 : -1;
  }, []);

  // ── Record listening behavior ──
  const recordBehavior = useCallback(() => {
    const { currentTrack, currentTime, duration, likedSongs, listeningHistory, repeatCount } = stateRef.current;
    if (!currentTrack || duration <= 0) return;

    const percentListened = currentTime / duration;
    let label = 'neutral';

    if (repeatCount > 1) label = 'looped';
    else if (percentListened > 0.8) label = 'listened_fully';
    else if (percentListened < 0.2 && currentTime > 3) label = 'skipped_early';
    else if (currentTime <= 3) return; // Ignore accidental clicks

    const isLiked = likedSongs.some(s => s.id === currentTrack.id);

    // Prevent duplicate adjacent recordings
    if (listeningHistory[0]?.track?.id === currentTrack.id && listeningHistory[0]?.label === label) return;

    dispatch({
      type: 'RECORD_BEHAVIOR',
      payload: { track: currentTrack, percentListened, label, isLiked, ts: Date.now() },
    });
  }, []);

  // ═══════════════════════════════════════════════
  // AI SMART SHUFFLE — Queue auto-fill
  // Called when queue is running low (≤2 remaining tracks)
  // ═══════════════════════════════════════════════
  const triggerAiShuffle = useCallback(async () => {
    if (aiShuffleInFlightRef.current) return; // Don't double-trigger
    aiShuffleInFlightRef.current = true;

    const { currentTrack, listeningHistory, recentTracks, queue, currentIndex } = stateRef.current;
    if (!currentTrack) {
      aiShuffleInFlightRef.current = false;
      return;
    }

    dispatch({ type: 'SET_AI_SHUFFLE_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR', payload: 'ai' });

    try {
      // Compute session mood from behavior
      const sessionMood = computeSessionMood(listeningHistory, recentTracks);

      // Determine skip signal
      const lastBehavior = listeningHistory[0];
      const skippedEarly = lastBehavior?.label === 'skipped_early';
      const listenPercent = lastBehavior?.percentListened || 1;

      // Get AI queries
      const queries = await generateSmartShuffle({
        currentSong: {
          title: currentTrack.title,
          artist: currentTrack.artist,
          genre: currentTrack.genre || '',
        },
        listenPercent,
        skippedEarly,
        sessionHistory: listeningHistory.slice(0, 5),
        sessionMood,
      });

      console.log('[Smart Shuffle] AI queries:', queries);

      // Convert queries → Spotify tracks → queue
      const newTracks = [];
      for (const query of queries) {
        try {
          const results = await searchTracks(query);
          if (results.length > 0) {
            const match = results[0];
            // Skip duplicates
            const alreadyInQueue = queue.some(q => q.id === match.id);
            const alreadyAdded = newTracks.some(t => t.id === match.id);
            if (!alreadyInQueue && !alreadyAdded && match.id !== currentTrack.id) {
              newTracks.push(match);
              // Pre-fetch videoId for instant playback
              searchVideoId(match.title, match.artist, match.id).catch(() => {});
            }
          }
        } catch {
          // Skip failed query
        }
      }

      if (newTracks.length > 0) {
        dispatch({ type: 'ADD_MULTIPLE_TO_QUEUE', payload: newTracks });
        console.log(`[Smart Shuffle] Added ${newTracks.length} tracks to queue`);
      }
    } catch (err) {
      console.error('[Smart Shuffle] Failed:', err);
      dispatch({
        type: 'SET_ERROR',
        payload: { type: 'ai', message: 'AI shuffle failed. Using fallback.' },
      });
    } finally {
      dispatch({ type: 'SET_AI_SHUFFLE_LOADING', payload: false });
      aiShuffleInFlightRef.current = false;
    }
  }, []);

  // ── Core: resolve videoId then play ──
  const resolveAndPlay = useCallback(async (track, newQueue, newIndex, retryCount = 0) => {
    if (!track) return;

    if (stateRef.current.currentTrack && stateRef.current.currentTrack.id !== track.id) {
      recordBehavior();
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR', payload: 'playback' });

    if (newQueue !== undefined && newIndex !== undefined) {
      dispatch({ type: 'SET_QUEUE_AND_INDEX', payload: { queue: newQueue, index: newIndex } });
    }

    try {
      const vid = await searchVideoId(track.title, track.artist, track.id);
      if (!vid) throw new Error('Could not find audio for this track.');
      dispatch({ type: 'SET_TRACK', payload: { track, videoId: vid } });
      dispatch({ type: 'TRACK_PLAYED', payload: track });
    } catch (err) {
      console.error('Playback error:', err);
      dispatch({
        type: 'SET_ERROR',
        payload: { type: 'playback', message: `Failed to play "${track.title}". Skipping...` },
      });
      if (retryCount < 3) {
        setTimeout(() => nextTrack(), 1500);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playTrack = useCallback(
    (track) => {
      const { queue, currentIndex } = stateRef.current;
      const existingIndex = queue.findIndex(t => t.id === track.id);
      if (existingIndex !== -1) {
        resolveAndPlay(track, queue, existingIndex);
      } else {
        const insertAt = currentIndex < 0 ? queue.length : currentIndex + 1;
        const newQueue = [...queue];
        newQueue.splice(insertAt, 0, track);
        resolveAndPlay(track, newQueue, insertAt);
      }
    },
    [resolveAndPlay]
  );

  const nextTrack = useCallback(async () => {
    const { queue, currentIndex, shuffleEnabled, shuffledIndices, recommendations } = stateRef.current;
    const nextIndex = getNextTrackIndex(currentIndex, queue.length, shuffleEnabled, shuffledIndices);

    if (nextIndex !== -1) {
      const track = queue[nextIndex];
      dispatch({ type: 'SET_QUEUE_AND_INDEX', payload: { queue, index: nextIndex } });
      await resolveAndPlay(track);
    } else if (recommendations && recommendations.length > 0) {
      // Smart autoplay from recommendations
      const nextRec = recommendations.find(r => !queue.some(q => q.id === r.id));
      if (nextRec) {
        playTrack(nextRec);
      } else {
        // All recs already in queue, trigger AI for more
        triggerAiShuffle();
      }
    } else {
      // No queue, no recs — trigger AI shuffle
      triggerAiShuffle();
    }
  }, [getNextTrackIndex, resolveAndPlay, playTrack, triggerAiShuffle]);

  // ── Check if queue is running low and auto-fill ──
  useEffect(() => {
    const { queue, currentIndex, currentTrack, userProfile } = state;
    if (!currentTrack) return;

    // Check if AI queuing is enabled in preferences
    const isAiQueuingEnabled = userProfile.role === 'premium' || userProfile.preferences?.queuingMode === 'ai';

    if (!isAiQueuingEnabled) return;

    const remaining = queue.length - currentIndex - 1;
    if (remaining <= AI_QUEUE_THRESHOLD && !aiShuffleInFlightRef.current) {
      triggerAiShuffle();
    }
  }, [state.currentIndex, state.queue.length, state.currentTrack?.id, state.userProfile, triggerAiShuffle]);

  // ── Load video into player when videoId changes ──
  useEffect(() => {
    if (state.videoId && playerRef.current) {
      try {
        playerRef.current.loadVideoById(state.videoId);
        playerRef.current.setVolume(state.volume);
      } catch { /* player not ready */ }
    }
  }, [state.videoId]); // eslint-disable-line

  // ── Time update interval ──
  useEffect(() => {
    if (state.isPlaying && playerRef.current) {
      timeUpdateRef.current = setInterval(() => {
        try {
          const time = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration();
          if (time != null) dispatch({ type: 'SET_CURRENT_TIME', payload: time });
          if (dur != null && dur > 0) dispatch({ type: 'SET_DURATION', payload: dur });
        } catch { /* ignore */ }
      }, 100);
    }
    return () => clearInterval(timeUpdateRef.current);
  }, [state.isPlaying]);

  // ── Smart Recommendations for UI ──
  useEffect(() => {
    if (!state.currentTrack) return;
    let cancelled = false;

    async function loadRecs() {
      dispatch({ type: 'CLEAR_ERROR', payload: 'recommendations' });
      dispatch({ type: 'SET_RECS_LOADING', payload: true });

      const { currentTrack, queue, recentTracks, repeatTrack, repeatCount, likedSongs, listeningHistory } =
        stateRef.current;

      // Layer 1: AI Smart Recommendations
      try {
        const aiResult = await getSmartRecommendations({
          recentTracks,
          repeatTrack,
          repeatCount,
          likedSongs,
          listeningHistory,
        });

        if (cancelled) return;

        if (aiResult?.songs?.length > 0) {
          const playableTracks = [];
          for (const seed of aiResult.songs) {
            try {
              const results = await searchTracks(seed.query || `${seed.title} ${seed.artist}`);
              if (results.length > 0) {
                const match = results[0];
                if (match.id !== currentTrack.id && !queue.some(q => q.id === match.id)) {
                  playableTracks.push(match);
                }
              }
            } catch { /* skip */ }
          }

          if (!cancelled && playableTracks.length > 0) {
            dispatch({
              type: 'SET_RECOMMENDATIONS',
              payload: {
                tracks: playableTracks,
                uiText: aiResult.uiText,
                mood: aiResult.mood,
                energy: aiResult.energy,
                reason: aiResult.reason,
              },
            });

            // Auto-queue if this is a brand-new session
            const freshState = stateRef.current;
            if (freshState.queue.length === 1 && freshState.currentIndex === 0) {
              dispatch({ type: 'ADD_MULTIPLE_TO_QUEUE', payload: playableTracks });
            }
            return;
          }
        }
      } catch {
        // AI failed — fall through to YouTube fallback
      }

      // Layer 2: YouTube Related Fallback
      if (!cancelled) {
        try {
          const related = await getRelatedVideos(stateRef.current.videoId, currentTrack.title, currentTrack.artist);
          if (!cancelled) {
            const mapped = related.map(r => ({
              id: r.videoId,
              title: r.title,
              artist: r.channelTitle,
              album: 'Recommended',
              albumArt: r.thumbnail,
              albumArtSmall: r.thumbnail,
              duration: 0,
              spotifyId: '',
              artistId: '',
              youtubeVideoId: r.videoId,
            }));
            dispatch({
              type: 'SET_RECOMMENDATIONS',
              payload: {
                tracks: mapped,
                uiText: `Based on the vibe of ${currentTrack.title}`,
                mood: '',
                energy: '',
                reason: '',
              },
            });
          }
        } catch (err) {
          if (!cancelled) {
            dispatch({
              type: 'SET_ERROR',
              payload: { type: 'recommendations', message: err.message },
            });
            dispatch({ type: 'SET_RECS_LOADING', payload: false });
          }
        }
      }
    }

    loadRecs();
    return () => { cancelled = true; };
  }, [state.currentTrack?.id]); // eslint-disable-line

  // ── Prefetch next track videoId ──
  useEffect(() => {
    const { currentIndex, queue } = state;
    if (currentIndex < 0 || !queue.length) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) return;
    const next = queue[nextIndex];
    if (prefetchedRef.current === next.id) return;
    prefetchedRef.current = next.id;
    searchVideoId(next.title, next.artist, next.id).catch(() => {});
  }, [state.currentIndex, state.queue]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (stateRef.current.isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
      dispatch({ type: 'TOGGLE_PLAY' });
    } catch { /* ignore */ }
  }, []);

  const prevTrack = useCallback(async () => {
    const { queue, currentIndex, currentTime } = stateRef.current;
    if (currentTime > 3 && playerRef.current) {
      playerRef.current.seekTo(0, true);
      dispatch({ type: 'SET_CURRENT_TIME', payload: 0 });
      return;
    }
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) return;
    const track = queue[prevIndex];
    dispatch({ type: 'SET_QUEUE_AND_INDEX', payload: { queue, index: prevIndex } });
    await resolveAndPlay(track);
  }, [resolveAndPlay]);

  const toggleShuffle = useCallback(() => {
    const { queue, currentIndex, shuffleEnabled } = stateRef.current;
    if (!shuffleEnabled) {
      const indices = Array.from({ length: queue.length }, (_, i) => i);
      const pool = indices.filter(i => i !== currentIndex);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      dispatch({ type: 'SET_SHUFFLED_INDICES', payload: [currentIndex, ...pool] });
    }
    dispatch({ type: 'SET_SHUFFLE' });
  }, []);

  const toggleLoop = useCallback(() => {
    dispatch({ type: 'SET_LOOP' });
  }, []);

  const setVolume = useCallback((value) => {
    dispatch({ type: 'SET_VOLUME', payload: value });
    if (playerRef.current) {
      try { playerRef.current.setVolume(value); } catch { /* ignore */ }
    }
  }, []);

  const seekTo = useCallback((time) => {
    if (playerRef.current) {
      try {
        playerRef.current.seekTo(time, true);
        dispatch({ type: 'SET_CURRENT_TIME', payload: time });
      } catch { /* ignore */ }
    }
  }, []);

  const addToQueue = useCallback((track) => {
    dispatch({ type: 'ADD_TO_QUEUE', payload: track });
  }, []);

  const removeFromQueue = useCallback((index) => {
    dispatch({ type: 'REMOVE_FROM_QUEUE', payload: index });
  }, []);

  const clearQueue = useCallback(() => {
    dispatch({ type: 'CLEAR_QUEUE' });
  }, []);

  const toggleLike = useCallback((track) => {
    dispatch({ type: 'TOGGLE_LIKE', payload: track });
    syncToBackend();
  }, [syncToBackend]);

  const isLiked = useCallback((trackId) => {
    return stateRef.current.likedSongs.some(s => s.id === trackId);
  }, []);

  const createPlaylist = useCallback((name) => {
    const newPlaylist = {
      id: Date.now().toString(),
      name,
      tracks: []
    };
    dispatch({ type: 'CREATE_PLAYLIST', payload: newPlaylist });
    syncToBackend();
    return newPlaylist;
  }, [syncToBackend]);

  const addToPlaylist = useCallback((playlistId, track) => {
    dispatch({ type: 'ADD_TO_PLAYLIST', payload: { playlistId, track } });
    syncToBackend();
  }, [syncToBackend]);

  const deletePlaylist = useCallback((playlistId) => {
    dispatch({ type: 'DELETE_PLAYLIST', payload: playlistId });
    syncToBackend();
  }, [syncToBackend]);

  const toggleFollowArtist = useCallback((artistName) => {
    dispatch({ type: 'TOGGLE_FOLLOW_ARTIST', payload: artistName });
    syncToBackend();
  }, [syncToBackend]);

  // ── Magic Vibe: AI-generated playlist from mood prompt ──
  const startMagicVibe = useCallback(async (prompt) => {
    dispatch({ type: 'SET_MAGIC_LOADING', payload: true });
    dispatch({ type: 'SET_MAGIC_ERROR', payload: null });

    try {
      const { likedSongs } = stateRef.current;
      const seeds = await generateMagicSeeds(prompt, likedSongs);

      const results = [];
      for (const seed of seeds) {
        try {
          const tracks = await searchTracks(`${seed.title} ${seed.artist}`);
          if (tracks.length > 0) results.push(tracks[0]);
        } catch { /* skip */ }
      }

      if (results.length === 0) {
        dispatch({ type: 'SET_MAGIC_ERROR', payload: 'No tracks found for your vibe.' });
        return;
      }

      const [first, ...rest] = results;
      playTrack(first);
      if (rest.length > 0) {
        dispatch({ type: 'ADD_MULTIPLE_TO_QUEUE', payload: rest });
      }
    } catch (err) {
      dispatch({ type: 'SET_MAGIC_ERROR', payload: err.message });
    } finally {
      dispatch({ type: 'SET_MAGIC_LOADING', payload: false });
    }
  }, [playTrack]);

  const openArtistProfile = useCallback(async (artistData) => {
    // If it's just a name/id from a track, fetch full data
    if (!artistData.image || !artistData.genre) {
      dispatch({ type: 'SET_SELECTED_ARTIST', payload: { ...artistData, loading: true } });
      dispatch({ type: 'SET_ARTIST_PROFILE_OPEN', payload: true });
      
      const fullData = await getArtistFullData(artistData.id);
      if (fullData) {
        dispatch({ type: 'SET_SELECTED_ARTIST', payload: fullData });
      } else {
        // Fallback for search or track-based ID
        dispatch({ type: 'SET_SELECTED_ARTIST', payload: {
          id: artistData.id,
          name: artistData.name || artistData.artist,
          image: `https://ui-avatars.com/api/?name=${encodeURIComponent(artistData.name || artistData.artist)}&background=random&color=fff&size=512`,
          genre: 'Artist'
        }});
      }
    } else {
      dispatch({ type: 'SET_SELECTED_ARTIST', payload: artistData });
      dispatch({ type: 'SET_ARTIST_PROFILE_OPEN', payload: true });
    }
  }, []);

  const closeArtistProfile = useCallback(() => {
    dispatch({ type: 'SET_ARTIST_PROFILE_OPEN', payload: false });
  }, []);

  // ── Track End Handler ──
  const onTrackEnd = useCallback(() => {
    const { loopEnabled, currentIndex, queue, shuffleEnabled, shuffledIndices, recommendations } =
      stateRef.current;

    // Record behavior before moving on
    recordBehavior();

    if (loopEnabled && playerRef.current) {
      playerRef.current.seekTo(0, true);
      playerRef.current.playVideo();
      return;
    }

    const nextIndex = getNextTrackIndex(currentIndex, queue.length, shuffleEnabled, shuffledIndices);
    if (nextIndex !== -1) {
      const track = queue[nextIndex];
      dispatch({ type: 'SET_QUEUE_AND_INDEX', payload: { queue, index: nextIndex } });
      resolveAndPlay(track);
    } else if (recommendations && recommendations.length > 0) {
      const nextRec = recommendations.find(r => !queue.some(q => q.id === r.id));
      if (nextRec) {
        playTrack(nextRec);
      } else {
        triggerAiShuffle();
      }
    } else {
      // Trigger AI to find more music
      triggerAiShuffle();
    }
  }, [resolveAndPlay, getNextTrackIndex, playTrack, recordBehavior, triggerAiShuffle]);

  const updateUserProfile = useCallback((profileData) => {
    dispatch({ type: 'UPDATE_USER_PROFILE', payload: profileData });
  }, []);

  const value = {
    ...state,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    toggleLoop,
    toggleShuffle,
    setVolume,
    seekTo,
    addToQueue,
    removeFromQueue,
    clearQueue,
    onTrackEnd,
    setPlayerRef,
    setUserInteracted,
    setPlayerReady,
    playerRef,
    toggleLike,
    isLiked,
    createPlaylist,
    addToPlaylist,
    deletePlaylist,
    startMagicVibe,
    triggerAiShuffle,
    updateUserProfile,
    toggleFollowArtist,
    openArtistProfile,
    closeArtistProfile,
    selectedArtist: state.selectedArtist,
    artistProfileOpen: state.artistProfileOpen,
    loginWithGoogle,
    logout,
    user: state.user,
    authStatus: state.token ? (state.user ? 'authenticated' : 'loading') : 'unauthenticated',
    isSyncing: state.isSyncing,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
