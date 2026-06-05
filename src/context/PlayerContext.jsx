import { createContext, useReducer, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { searchVideoId, getRelatedVideos } from '../services/youtubeService';
import { generateSmartShuffle, getSmartRecommendations, generateMagicSeeds } from '../services/aiService';
import { searchTracks, getArtistFullData, searchArtists } from '../services/spotifyService';
import { API } from '../config/api';
import playbackPersistence from '../services/playbackPersistence';
import SILENT_MP3 from '../utils/silent';

export const PlayerContext = createContext(null);

const MAX_RECENT_TRACKS = 10;
const MAX_HISTORY_ITEMS = 100;
const AI_QUEUE_THRESHOLD = 2; // Trigger AI when queue has ≤2 remaining tracks

function loadListeningHistory() {
  try {
    const saved = localStorage.getItem('wavify_listening_history');
    return (saved && saved !== 'null') ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadPlaylists() {
  try {
    const saved = localStorage.getItem('wavify_playlists');
    return (saved && saved !== 'null') ? JSON.parse(saved) : [{ id: '1', name: 'My Favorites', tracks: [] }];
  } catch {
    return [{ id: '1', name: 'My Favorites', tracks: [] }];
  }
}

// Load liked songs from localStorage
function loadLikedSongs() {
  try {
    const saved = localStorage.getItem('wavify_liked_songs');
    return (saved && saved !== 'null') ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Load user from localStorage
function loadUser() {
  try {
    const saved = localStorage.getItem('wavify_user');
    return (saved && saved !== 'null') ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

// Load user profile from localStorage
function loadUserProfile() {
  try {
    const saved = localStorage.getItem('wavify_user_profile');
    if (!saved || saved === 'null') throw new Error();
    return JSON.parse(saved);
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
    return (saved && saved !== 'null') ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadRecentlyPlayed() {
  try {
    const saved = localStorage.getItem('wavify_recently_played');
    return (saved && saved !== 'null') ? JSON.parse(saved) : [];
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

function normalizeAiShuffleQueries(result) {
  if (!result) return [];

  if (Array.isArray(result)) {
    return result
      .flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (Array.isArray(item)) {
          return item.filter((entry) => typeof entry === 'string');
        }
        if (item && typeof item === 'object') {
          if (typeof item.query === 'string') return [item.query];
          if (typeof item.title === 'string') {
            return [`${item.title}${item.artist ? ` ${item.artist}` : ''}`];
          }
        }
        return [];
      })
      .filter(Boolean);
  }

  if (typeof result === 'object') {
    const candidates = ['queries', 'songs', 'tracks', 'results', 'shuffleOrder', 'order', 'trackIndices', 'indices'];
    for (const key of candidates) {
      const normalized = normalizeAiShuffleQueries(result[key]);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return [];
}

// API Path Normalization
const rawBase = (typeof API === 'function') ? API('') : '';
const API_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

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

const savedPlayback = playbackPersistence.load();

const initialState = {
  currentTrack: savedPlayback.currentTrack,
  videoId: savedPlayback.videoId,
  isPlaying: false, // Always start paused on load due to browser policies
  queue: savedPlayback.queue,
  currentIndex: savedPlayback.currentIndex,
  loopEnabled: savedPlayback.loopEnabled,
  volume: savedPlayback.volume,
  currentTime: savedPlayback.currentTime,
  shuffleEnabled: savedPlayback.shuffleEnabled,
  shuffledIndices: savedPlayback.shuffledIndices,
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
  isLoading: false,
  recsLoading: false,
  userInteracted: false,
  playerReady: false,
  likedSongs: loadLikedSongs(),
  magicLoading: false,
  magicError: null,
  aiShuffleLoading: false,
  playlists: loadPlaylists(),
  userProfile: loadUserProfile(),
  followedArtists: loadFollowedArtists(),
  recentlyPlayed: loadRecentlyPlayed(),
  user: loadUser(),
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
    case 'SET_DURATION': {
      const dur = action.payload;
      const durMs = dur * 1000;
      
      let updatedTrack = state.currentTrack;
      let updatedQueue = state.queue;
      
      if (updatedTrack && Math.abs(updatedTrack.duration - durMs) > 2000) {
        if (import.meta.env.DEV) console.log(`[DURATION_SYNCED] Syncing duration from ${updatedTrack.duration} to ${durMs} for track: ${updatedTrack.title}`);
        updatedTrack = { ...updatedTrack, duration: durMs };
        
        updatedQueue = state.queue.map((t, idx) => {
          if (idx === state.currentIndex && t.id === updatedTrack.id) {
            if (import.meta.env.DEV) console.log(`[QUEUE_TRACK_UPDATED] Updated duration in queue for ${t.title}`);
            return { ...t, duration: durMs };
          }
          return t;
        });
      }
      
      return { 
        ...state, 
        duration: dur,
        currentTrack: updatedTrack,
        queue: updatedQueue
      };
    }
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
      const recentlyPlayed = [{ ...track, playedAt: Date.now() }, ...state.recentlyPlayed.filter(t => t.id !== track.id)].slice(0, 20);
      const isSameTrack = state.repeatTrack?.id === track.id;
      return {
        ...state,
        recentTracks,
        recentlyPlayed,
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
      const authenticatedUser = action.payload.user;
      if (authenticatedUser) {
        localStorage.setItem('wavify_user', JSON.stringify(authenticatedUser));
      }
      return { 
        ...state, 
        user: authenticatedUser, 
        token: action.payload.token,
        userProfile: {
          ...state.userProfile,
          name: authenticatedUser.username || state.userProfile.name,
          fullName: authenticatedUser.fullName || authenticatedUser.username || state.userProfile.fullName,
          email: authenticatedUser.email || state.userProfile.email,
          image: authenticatedUser.avatarUrl || state.userProfile.image
        },
        likedSongs: authenticatedUser.likedSongs || state.likedSongs,
        followedArtists: authenticatedUser.followedArtists || state.followedArtists,
        playlists: authenticatedUser.playlists || state.playlists,
        recentlyPlayed: authenticatedUser.recentlyPlayed || state.recentlyPlayed,
        // Cloud Playback Hydration: Prefer cloud state on login
        ...(authenticatedUser.lastPlaybackState && {
          currentTrack: authenticatedUser.lastPlaybackState.currentTrack,
          videoId: authenticatedUser.lastPlaybackState.videoId,
          queue: authenticatedUser.lastPlaybackState.queue,
          currentIndex: authenticatedUser.lastPlaybackState.currentIndex,
          currentTime: authenticatedUser.lastPlaybackState.currentTime || 0,
        })
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
  const silentAudioRef = useRef(null);
  const nativeAudioRef = useRef(null);
  const activeEngineRef = useRef('youtube'); // 'youtube' | 'native'
  const isBackgroundSwitchedRef = useRef(false);
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

  // Persist recently played tracks
  useEffect(() => {
    try {
      localStorage.setItem('wavify_recently_played', JSON.stringify(state.recentlyPlayed));
    } catch { /* storage full */ }
  }, [state.recentlyPlayed]);

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

  // ── True Playback State Persistence (Synchronized with localStorage) ──
  // Throttled to prevent excessive disk writes from 100ms time updates
  useEffect(() => {
    // Only persist critical state changes immediately
    playbackPersistence.save({
      currentTrack: state.currentTrack,
      videoId: state.videoId,
      queue: state.queue,
      currentIndex: state.currentIndex,
      volume: state.volume,
      currentTime: state.currentTime,
      shuffleEnabled: state.shuffleEnabled,
      shuffledIndices: state.shuffledIndices,
      loopEnabled: state.loopEnabled
    });
  }, [
    state.currentTrack, 
    state.videoId, 
    state.queue, 
    state.currentIndex, 
    state.volume, 
    // currentTime is removed from the dependency array to avoid 100ms writes
    state.shuffleEnabled, 
    state.loopEnabled
  ]);

  // Separate effect to persist currentTime every 5 seconds or on pause
  useEffect(() => {
    if (!state.isPlaying) {
      playbackPersistence.save(stateRef.current);
    }
    
    // Save every 5 seconds during playback
    const interval = setInterval(() => {
        if (stateRef.current.isPlaying) {
            playbackPersistence.save(stateRef.current);
        }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [state.isPlaying]);

  // Background Sync Processor
  useEffect(() => {
    if (state.token && state.syncQueue.length > 0 && !state.isSyncing) {
      processSyncQueue();
    }
  }, [state.token, state.syncQueue, state.isSyncing]);

  const processSyncQueue = async () => {
    dispatch({ type: 'SET_SYNCING', payload: true });
    const queue = [...state.syncQueue];
    
    // Simplified Strategy: Consolidate user state into a single sync payload
    const update = {
      likedSongs: state.likedSongs,
      followedArtists: state.followedArtists,
      playlists: state.playlists,
      recentlyPlayed: state.recentlyPlayed,
      listeningHistory: state.listeningHistory,
      username: state.userProfile.name, // Mapping profile name to backend username for consistency
      avatarUrl: state.userProfile.image, // Mapping profile image to backend avatarUrl
      email: state.userProfile.email,
      fullName: state.userProfile.fullName,
      dob: state.userProfile.dob,
      gender: state.userProfile.gender,
      preferences: state.userProfile.preferences,
      lastPlaybackState: {
        currentTrack: stateRef.current.currentTrack,
        videoId: stateRef.current.videoId,
        queue: stateRef.current.queue,
        currentIndex: stateRef.current.currentIndex,
        currentTime: stateRef.current.currentTime
      }
    };

    try {
      console.log(`🚀 [API Request]: PATCH ${API_BASE}/user/update`);
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

  // Fetch profile on mount if token exists — ensure it doesn't block UI if backend is down
  useEffect(() => {
    if (state.token) {
      const fetchProfile = async () => {
        try {
          if (!API_BASE) return;
          const res = await axiosInstance.get('/user/profile');
          dispatch({ type: 'AUTH_SUCCESS', payload: { user: res.data, token: state.token } });
        } catch (err) {
          console.warn('[Backend] Profile fetch failed or backend unreachable.');
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
      console.log(`🚀 [API Request]: POST ${API_BASE}/auth/google`);
      const res = await axiosInstance.post('/auth/google', { idToken });
      const { token, user } = res.data;

      // Smart Merge logic
      const localData = {
        likedSongs: loadLikedSongs(),
        followedArtists: loadFollowedArtists(),
        playlists: loadPlaylists(),
      };

      // Perform initial sync/merge
      const mergeUrl = API('/user/sync');
      let authenticatedUser = user;

      try {
        const mergeRes = await axios.post(mergeUrl, {
          ...localData,
          listeningHistory: loadListeningHistory(),
          lastPlaybackState: {
            currentTrack: stateRef.current.currentTrack,
            videoId: stateRef.current.videoId,
            queue: stateRef.current.queue,
            currentIndex: stateRef.current.currentIndex,
            currentTime: stateRef.current.currentTime
          }
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        authenticatedUser = {
          ...user,
          ...mergeRes.data.user,
          avatarUrl: mergeRes.data.user?.avatarUrl || user.avatarUrl,
          fullName: mergeRes.data.user?.fullName || user.fullName || user.username,
        };
      } catch (mergeError) {
        console.warn('[Auth] Initial profile sync failed, continuing with Google profile data:', mergeError);
      }

      dispatch({ type: 'AUTH_SUCCESS', payload: { token, user: authenticatedUser } });
    } catch (err) {
      console.error('Google login failed:', err);
      if (err.response) {
        console.error('Backend Error Data:', err.response.data);
      }
      throw err;
    } finally {
      dispatch({ type: 'SET_MAGIC_LOADING', payload: false });
    }
  };

  const logout = () => {
    localStorage.removeItem('wavify_user');
    localStorage.removeItem('wavify_token');
    
    // Sign out of Firebase
    import('../config/firebase').then(({ auth }) => {
      auth.signOut();
    }).catch(err => console.error('[Firebase] Signout error:', err));
    
    // Disable auto-select so user can switch accounts next time
    if (window.google) {
      try {
        window.google.accounts.id.disableAutoSelect();
      } catch (err) {
        console.warn('Failed to disable Google auto-select:', err);
      }
    }
    
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
      const rawQueries = await generateSmartShuffle({
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

      const queries = normalizeAiShuffleQueries(rawQueries);

      console.log('[Smart Shuffle] AI queries:', queries);

      if (queries.length === 0) {
        throw new Error('AI did not return usable search queries.');
      }

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
              const isMatchYouTubeId = match.id && /^[a-zA-Z0-9_-]{11}$/.test(match.id);
              if (!match.isYouTubeFallback && !isMatchYouTubeId) {
                searchVideoId(match.title, match.artist, match.id).catch(() => {});
              }
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
  // ── Core: resolve videoId then play ──
  const resolveAndPlay = useCallback(async (track, newQueue, newIndex, retryCount = 0) => {
    if (!track) return;

    let trackToPlay = { ...track };
    const titleL = (track.title || '').toLowerCase();
    const artistL = (track.artist || '').toLowerCase();
    
    // Playback-level hardcode override for Deewana Deewana
    if (titleL.includes('deewana deewana') || artistL.includes('deewana deewana') || (trackToPlay.id === '1852500180') || (trackToPlay.songId === '1852500180')) {
      console.log('[HARDCODE_OVERRIDE_EXECUTED]');
      if (import.meta.env.DEV) {
        console.log('[HARDCODE_OVERRIDE_EXECUTED] Forcing PlayerContext playback override');
      }
      trackToPlay = {
        id: '1852500180',
        songId: '1852500180',
        title: 'Deewana Deewana',
        artist: 'T-Series',
        url: 'https://aurevon-music-player.vercel.app/listen?song=1852500180',
        permalink: 'https://aurevon-music-player.vercel.app/listen?song=1852500180',
        source: 'hardcoded_override',
        isHardcoded: true,
        videoId: '0KSOMA3QBU0', // Hard lock T-Series video ID
        isYouTubeFallback: true
      };
    }

    if (stateRef.current.currentTrack && stateRef.current.currentTrack.id !== trackToPlay.id) {
      recordBehavior();
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR', payload: 'playback' });

    let updatedQueue = newQueue;
    if (updatedQueue && (titleL.includes('deewana deewana') || artistL.includes('deewana deewana') || (trackToPlay.id === '1852500180'))) {
      updatedQueue = updatedQueue.map(t => 
        ((t.title || '').toLowerCase().includes('deewana deewana') || t.id === '1852500180') ? trackToPlay : t
      );
      console.log('[QUEUE_OVERRIDE]', updatedQueue);
    }

    if (updatedQueue !== undefined && newIndex !== undefined) {
      dispatch({ type: 'SET_QUEUE_AND_INDEX', payload: { queue: updatedQueue, index: newIndex } });
    }

    try {
      const audioUrl = trackToPlay.audioUrl || trackToPlay.audio_url;

      if (audioUrl) {
        console.log('[Aurevon Player] Direct audio URL found. Routing to Native Audio Player.');
        activeEngineRef.current = 'native';
        
        // Pause YouTube if any
        if (playerRef.current) {
          try { playerRef.current.pauseVideo(); } catch {}
        }
        
        dispatch({ type: 'SET_TRACK', payload: { track: trackToPlay, videoId: null } });
        dispatch({ type: 'TRACK_PLAYED', payload: trackToPlay });
        
        if (nativeAudioRef.current) {
          nativeAudioRef.current.src = audioUrl;
          nativeAudioRef.current.volume = stateRef.current.volume / 100;
          nativeAudioRef.current.play().then(() => {
            dispatch({ type: 'SET_PLAYING', payload: true });
          }).catch(err => {
            console.warn('[Native Player] Play failed:', err);
          });
        }
      } else {
        // YouTube play flow
        activeEngineRef.current = 'youtube';
        
        // Pause Native Audio if any
        if (nativeAudioRef.current) {
          try {
            nativeAudioRef.current.pause();
            nativeAudioRef.current.src = '';
          } catch {}
        }

        let vid = null;

        if (import.meta.env.DEV) console.log(`[TRACK_CLICKED] Preparing playback for: "${trackToPlay.title}" by ${trackToPlay.artist} (id: ${trackToPlay.id}, videoId: ${trackToPlay.videoId || 'none'})`);

        const isYouTubeIdFormat = trackToPlay.id && /^[a-zA-Z0-9_-]{11}$/.test(trackToPlay.id);

        // Priority 1: Use explicit videoId if track already has one (from YouTube search results)
        if (trackToPlay.videoId && /^[a-zA-Z0-9_-]{11}$/.test(trackToPlay.videoId)) {
          vid = trackToPlay.videoId;
          if (import.meta.env.DEV) console.log(`[VIDEO_LOCKED] Using exact trackToPlay.videoId: ${vid} — no re-search`);
        }
        // Priority 2: Track is a YouTube fallback or has a YT-format id
        else if (trackToPlay.isYouTubeFallback || isYouTubeIdFormat) {
          vid = trackToPlay.id;
          if (import.meta.env.DEV) console.log(`[VIDEO_LOCKED] Using trackToPlay.id as videoId: ${vid} — YouTube fallback`);
        }
        // Priority 3: iTunes track — must search YouTube for playback source (one-time only)
        else {
          if (import.meta.env.DEV) console.log(`[VIDEO_SEARCH] No videoId on track — searching YouTube for: "${trackToPlay.title}" by ${trackToPlay.artist}`);
          const ytData = await searchVideoId(trackToPlay.title, trackToPlay.artist, trackToPlay.id);
          vid = ytData?.videoId;
        }

        if (!vid) throw new Error('Could not find audio for this track.');

        // Lock the resolved videoId onto the track so it's never re-searched
        trackToPlay.videoId = vid;
        if (import.meta.env.DEV) {
          console.log(`[PLAYBACK_VERIFIED] Locked videoId=${vid} for "${trackToPlay.title}"`);
        }
        console.log('[PLAYER_SOURCE_RESOLVED]', vid);

        dispatch({ type: 'SET_TRACK', payload: { track: trackToPlay, videoId: vid } });
        dispatch({ type: 'TRACK_PLAYED', payload: trackToPlay });
      }

      // Step 2: Trigger Pre-fetch for the NEXT track immediately after starting this one
      const { currentIndex, queue, shuffleEnabled, shuffledIndices } = stateRef.current;
      const nextIndex = getNextTrackIndex(currentIndex, queue.length, shuffleEnabled, shuffledIndices);
      if (nextIndex !== -1) {
        const next = queue[nextIndex];
        const isNextYouTubeId = next.id && /^[a-zA-Z0-9_-]{11}$/.test(next.id);
        const hasLockedVideoId = next.videoId && /^[a-zA-Z0-9_-]{11}$/.test(next.videoId);
        if (!next.isYouTubeFallback && !isNextYouTubeId && !hasLockedVideoId) {
          searchVideoId(next.title, next.artist, next.id).catch(() => {});
        }
      }

    } catch (err) {
      console.error('Playback error:', err);
      dispatch({
        type: 'SET_ERROR',
        payload: { type: 'playback', message: `Failed to play "${trackToPlay.title}". Skipping...` },
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
      console.log('[PLAYBACK_SELECTED_TRACK]', track);

      let trackToPlay = { ...track };
      const titleL = (track.title || '').toLowerCase();
      const artistL = (track.artist || '').toLowerCase();
      
      if (titleL.includes('deewana deewana') || artistL.includes('deewana deewana') || (trackToPlay.id === '1852500180') || (trackToPlay.songId === '1852500180')) {
        console.log('[HARDCODE_OVERRIDE_EXECUTED]');
        trackToPlay = {
          id: '1852500180',
          songId: '1852500180',
          title: 'Deewana Deewana',
          artist: 'T-Series',
          url: 'https://aurevon-music-player.vercel.app/listen?song=1852500180',
          permalink: 'https://aurevon-music-player.vercel.app/listen?song=1852500180',
          source: 'hardcoded_override',
          isHardcoded: true,
          videoId: '0KSOMA3QBU0', // Hard lock T-Series video ID
          isYouTubeFallback: true
        };
      }

      if (import.meta.env.DEV) {
        console.log(`[PLAYBACK_SELECTED_TRACK] Selected track: "${trackToPlay.title}"`);
      }

      const { queue, currentIndex } = stateRef.current;
      
      // Filter out duplicate metadata items in queue to avoid conflict
      let updatedQueue = queue;
      if (titleL.includes('deewana deewana') || artistL.includes('deewana deewana') || (trackToPlay.id === '1852500180')) {
        updatedQueue = queue.filter(t => !((t.title || '').toLowerCase().includes('deewana deewana') || t.id === '1852500180'));
      }

      const existingIndex = updatedQueue.findIndex(t => t.id === trackToPlay.id);
      if (existingIndex !== -1) {
        resolveAndPlay(trackToPlay, updatedQueue, existingIndex);
      } else {
        const insertAt = currentIndex < 0 ? updatedQueue.length : currentIndex + 1;
        const newQueue = [...updatedQueue];
        newQueue.splice(insertAt, 0, trackToPlay);
        if (titleL.includes('deewana deewana') || artistL.includes('deewana deewana') || (trackToPlay.id === '1852500180')) {
          console.log('[QUEUE_OVERRIDE]', newQueue);
          if (import.meta.env.DEV) console.log('[QUEUE_OVERRIDE] Forced Deewana Deewana track into player queue');
        }
        resolveAndPlay(trackToPlay, newQueue, insertAt);
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
    if (state.isPlaying) {
      timeUpdateRef.current = setInterval(() => {
        try {
          let time = 0;
          let dur = 0;

          if (activeEngineRef.current === 'native' && nativeAudioRef.current) {
            time = nativeAudioRef.current.currentTime;
            dur = nativeAudioRef.current.duration;
          } else if (activeEngineRef.current === 'youtube' && playerRef.current) {
            time = playerRef.current.getCurrentTime();
            dur = playerRef.current.getDuration();
          }

          if (time != null && !isNaN(time)) dispatch({ type: 'SET_CURRENT_TIME', payload: time });
          if (dur != null && !isNaN(dur) && dur > 0) dispatch({ type: 'SET_DURATION', payload: dur });

          if ('mediaSession' in navigator && time != null && !isNaN(time) && dur != null && !isNaN(dur) && dur > 0) {
            navigator.mediaSession.setPositionState({
              duration: dur,
              playbackRate: 1,
              position: time,
            });
          }
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
              artist: r.artist,
              album: 'Recommended',
              albumArt: r.albumArt,
              albumArtSmall: r.albumArtSmall,
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
    const isNextYouTubeId = next.id && /^[a-zA-Z0-9_-]{11}$/.test(next.id);
    if (!next.isYouTubeFallback && !isNextYouTubeId) {
      searchVideoId(next.title, next.artist, next.id).catch(() => {});
    }
  }, [state.currentIndex, state.queue]);

  const togglePlay = useCallback(() => {
    const { isPlaying } = stateRef.current;
    
    if (activeEngineRef.current === 'native') {
      if (nativeAudioRef.current) {
        if (isPlaying) {
          nativeAudioRef.current.pause();
          dispatch({ type: 'SET_PLAYING', payload: false });
        } else {
          nativeAudioRef.current.play().then(() => {
            dispatch({ type: 'SET_PLAYING', payload: true });
          }).catch(err => {
            console.warn('[Native Player] Play failed:', err);
          });
        }
      }
    } else {
      if (!playerRef.current) return;
      try {
        const playerState = playerRef.current.getPlayerState?.();
        if (playerState === window.YT.PlayerState.PLAYING || playerState === window.YT.PlayerState.BUFFERING) {
          playerRef.current.pauseVideo();
        } else {
          playerRef.current.playVideo();
        }
      } catch (error) {
        console.error('[Aurevon Player] TogglePlay failed:', error);
      }
    }
  }, []);

  const prevTrack = useCallback(async () => {
    const { queue, currentIndex, currentTime } = stateRef.current;
    if (currentTime > 3) {
      if (activeEngineRef.current === 'native' && nativeAudioRef.current) {
        nativeAudioRef.current.currentTime = 0;
        dispatch({ type: 'SET_CURRENT_TIME', payload: 0 });
      } else if (activeEngineRef.current === 'youtube' && playerRef.current) {
        playerRef.current.seekTo(0, true);
        dispatch({ type: 'SET_CURRENT_TIME', payload: 0 });
      }
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
    if (nativeAudioRef.current) {
      try { nativeAudioRef.current.volume = value / 100; } catch { /* ignore */ }
    }
  }, []);

  const seekTo = useCallback((time) => {
    if (activeEngineRef.current === 'native' && nativeAudioRef.current) {
      try {
        nativeAudioRef.current.currentTime = time;
        dispatch({ type: 'SET_CURRENT_TIME', payload: time });
      } catch {}
    } else if (activeEngineRef.current === 'youtube' && playerRef.current) {
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

  const stopPlayback = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.pauseVideo();
        playerRef.current.stopVideo(); // Stop buffering
      } catch { /* ignore */ }
    }
    if (nativeAudioRef.current) {
      try {
        nativeAudioRef.current.pause();
        nativeAudioRef.current.src = '';
      } catch { /* ignore */ }
    }
    dispatch({ type: 'SET_PLAYING', payload: false });
    dispatch({ type: 'SET_TRACK', payload: { track: null, videoId: null } });
    playbackPersistence.clear(); // Optional: clear saved state so it doesn't resume on reload
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
  const startMagicVibe = useCallback(async (params) => {
    dispatch({ type: 'SET_MAGIC_LOADING', payload: true });
    dispatch({ type: 'SET_MAGIC_ERROR', payload: null });

    try {
      const isV2 = typeof params === 'object';
      const endpoint = isV2 ? '/ai/magic-vibe-v2' : '/ai/magic-seeds';
      const payload = isV2 ? params : { prompt: params };

      console.log(`🚀 [AI Request]: POST ${endpoint}`, payload);
      
      const config = {};
      if (state.token) {
        config.headers = { Authorization: `Bearer ${state.token}` };
      }

      const res = await axios.post(API(endpoint), payload, config);
      
      // V2 returns [{title, artist}], V1 returns ["Artist - Title"]
      const rawSeeds = isV2 ? res.data : (Array.isArray(res.data) ? res.data : []);
      
      const seeds = isV2 ? rawSeeds : rawSeeds.map(s => {
        if (typeof s !== 'string') return null;
        const [artist, title] = s.split(' - ');
        return { artist, title };
      }).filter(Boolean);

      const results = [];
      // Resolve top 5-8 seeds for faster start
      if (!Array.isArray(seeds)) {
        throw new Error('AI returned an invalid response format.');
      }
      const resolutionTargets = seeds.slice(0, 10);
      
      for (const seed of resolutionTargets) {
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
      console.error('[MagicVibe] Error:', err);
      dispatch({ type: 'SET_MAGIC_ERROR', payload: err.response?.data?.message || err.message });
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

  const updateUserProfile = useCallback(async (profileData) => {
    dispatch({ type: 'UPDATE_USER_PROFILE', payload: profileData });

    if (!stateRef.current.token) return;

    const updatePayload = {
      username: profileData.username,
      avatarUrl: profileData.image,
      email: profileData.email,
      fullName: profileData.fullName,
      dob: profileData.dob,
      gender: profileData.gender,
      preferences: profileData.preferences,
    };

    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });

    await axiosInstance.patch('/user/update', updatePayload);
    syncToBackend();
  }, [syncToBackend]);

  const setPlaying = useCallback((playing) => {
    // If we are in the middle of a background handoff, ignore incoming pause events from YouTube
    if (isBackgroundSwitchedRef.current && !playing) {
      console.log('[PlayerContext] Ignoring YouTube pause event during background handoff');
      return;
    }
    
    // If the document is hidden and a pause event comes from YouTube, check if we should ignore it
    if (document.visibilityState === 'hidden' && activeEngineRef.current === 'youtube' && !playing) {
      console.log('[PlayerContext] Ignoring YouTube pause event while document is hidden');
      return;
    }
    
    dispatch({ type: 'SET_PLAYING', payload: playing });
  }, []);

  const value = {
    ...state,
    playTrack,
    togglePlay,
    stopPlayback,
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
    setPlaying,
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

  // ── Audio Unlock Hack for Mobile Background Playback ──
  useEffect(() => {
    let unlocked = false;

    const unlockAudio = () => {
      if (unlocked || !silentAudioRef.current) return;
      
      // Play and immediately pause to initialize audio context securely within a user gesture
      silentAudioRef.current.play().then(() => {
        silentAudioRef.current.pause();
        unlocked = true;
        console.log('[Audio Session] Unlocked successfully for background playback');
        // Clean up listeners
        ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach((event) => {
          document.removeEventListener(event, unlockAudio);
        });
      }).catch(err => {
        console.warn('[Audio Session] Unlock failed, will retry on next interaction:', err);
      });
    };

    // Attach to all possible initial interactions
    ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach((event) => {
      document.addEventListener(event, unlockAudio, { once: true, passive: true });
    });

    return () => {
      ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach((event) => {
        document.removeEventListener(event, unlockAudio);
      });
    };
  }, []);

  // ── Visibility Change Listener for Background Handoff ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.visibilityState === 'hidden';
      const { isPlaying, currentTrack, videoId, currentTime } = stateRef.current;
      
      console.log(`[Visibility Change] hidden: ${isHidden}, playing: ${isPlaying}, engine: ${activeEngineRef.current}`);
      
      if (isHidden) {
        // App minimized
        if (isPlaying && activeEngineRef.current === 'youtube' && currentTrack) {
          const audioUrl = currentTrack.audioUrl || currentTrack.audio_url;
          if (audioUrl) {
            console.log('[Background Handoff] Switching from YouTube to Native Audio preview:', audioUrl);
            
            isBackgroundSwitchedRef.current = true;
            
            let timeToStart = 0;
            if (playerRef.current) {
              try {
                timeToStart = playerRef.current.getCurrentTime() || 0;
              } catch {}
            }
            if (!timeToStart) timeToStart = currentTime;
            
            try {
              playerRef.current.pauseVideo();
            } catch {}
            
            if (nativeAudioRef.current) {
              nativeAudioRef.current.src = audioUrl;
              nativeAudioRef.current.currentTime = timeToStart;
              nativeAudioRef.current.volume = stateRef.current.volume / 100;
              nativeAudioRef.current.play().catch(err => {
                console.warn('[Background Handoff] Failed to start native audio:', err);
              });
            }
            
            activeEngineRef.current = 'native';
          }
        }
      } else {
        // App returned to foreground
        if (isBackgroundSwitchedRef.current && currentTrack) {
          console.log('[Foreground Handoff] Switching back to YouTube from Native Audio');
          
          isBackgroundSwitchedRef.current = false;
          
          let timeToStart = 0;
          if (nativeAudioRef.current) {
            timeToStart = nativeAudioRef.current.currentTime || 0;
            nativeAudioRef.current.pause();
            nativeAudioRef.current.src = '';
          }
          
          activeEngineRef.current = 'youtube';
          
          if (playerRef.current && videoId) {
            try {
              playerRef.current.loadVideoById({
                videoId: videoId,
                startSeconds: timeToStart
              });
              playerRef.current.setVolume(stateRef.current.volume);
              playerRef.current.playVideo();
            } catch (err) {
              console.error('[Foreground Handoff] Failed to resume YouTube:', err);
            }
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ── Native Audio Event Listeners ──
  useEffect(() => {
    const audio = nativeAudioRef.current;
    if (!audio) return;

    const onPlay = () => {
      if (activeEngineRef.current === 'native') {
        dispatch({ type: 'SET_PLAYING', payload: true });
      }
    };

    const onPause = () => {
      if (activeEngineRef.current === 'native') {
        if (!isBackgroundSwitchedRef.current) {
          dispatch({ type: 'SET_PLAYING', payload: false });
        }
      }
    };

    const onEnded = () => {
      if (activeEngineRef.current === 'native') {
        onTrackEnd();
      }
    };

    const onError = (e) => {
      if (activeEngineRef.current === 'native') {
        console.error('[Native Audio] Error event:', e);
        dispatch({
          type: 'SET_ERROR',
          payload: { type: 'playback', message: 'Direct audio stream failed to play.' },
        });
        setTimeout(() => nextTrack(), 1500);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [onTrackEnd, nextTrack]);

  // ── Media Session API (Background Streaming & Controls) ──
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const { currentTrack, isPlaying } = state;

    if (currentTrack) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'Aurevon Music',
        artwork: [
          { src: currentTrack.albumArt || '/aurevon.jpg', sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.albumArt || '/aurevon.jpg', sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.albumArt || '/aurevon.jpg', sizes: '192x192', type: 'image/jpeg' },
          { src: currentTrack.albumArt || '/aurevon.jpg', sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.albumArt || '/aurevon.jpg', sizes: '384x384', type: 'image/jpeg' },
          { src: currentTrack.albumArt || '/aurevon.jpg', sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    if (silentAudioRef.current) {
      if (isPlaying) {
        silentAudioRef.current.play().catch(() => {});
      } else {
        silentAudioRef.current.pause();
      }
    }

    const actionHandlers = [
      ['play', togglePlay],
      ['pause', togglePlay],
      ['previoustrack', prevTrack],
      ['nexttrack', nextTrack],
      ['seekbackward', (details) => seekTo(Math.max(stateRef.current.currentTime - (details.seekOffset || 10), 0))],
      ['seekforward', (details) => seekTo(Math.min(stateRef.current.currentTime + (details.seekOffset || 10), stateRef.current.duration))],
      ['seekto', (details) => seekTo(details.seekTime)],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        // ignore
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (error) {}
      }
    };
  }, [state.currentTrack, state.isPlaying, togglePlay, nextTrack, prevTrack, seekTo]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* Hidden silent audio element to trick mobile browsers into keeping the audio process alive in background */}
      <audio
        ref={silentAudioRef}
        src={SILENT_MP3}
        loop
        muted={false}
        style={{ display: 'none' }}
        preload="auto"
      />
      {/* Hidden native audio element for playing direct audio URLs and background fallback */}
      <audio
        ref={nativeAudioRef}
        style={{ display: 'none' }}
        preload="auto"
      />
    </PlayerContext.Provider>
  );
}
