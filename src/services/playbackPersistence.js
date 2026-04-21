/**
 * Service for local playback state persistence.
 * Serializes and deserializes the critical player state (queue, current track, etc.)
 */

const STORAGE_KEY = 'aurevon_playback_state';

const defaultState = {
  currentTrack: null,
  videoId: null,
  queue: [],
  currentIndex: -1,
  volume: 80,
  currentTime: 0,
  shuffleEnabled: false,
  shuffledIndices: [],
  loopEnabled: false
};

const playbackPersistence = {
  save(state) {
    try {
      const data = {
        currentTrack: state.currentTrack,
        videoId: state.videoId,
        queue: state.queue,
        currentIndex: state.currentIndex,
        volume: state.volume,
        currentTime: state.currentTime,
        shuffleEnabled: state.shuffleEnabled,
        shuffledIndices: state.shuffledIndices,
        loopEnabled: state.loopEnabled
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Persistence] Failed to save playback state:', e);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaultState;
      
      const parsed = JSON.parse(saved);
      return {
        ...defaultState,
        ...parsed,
        // Ensure some sanity checks
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        currentIndex: typeof parsed.currentIndex === 'number' ? parsed.currentIndex : -1,
      };
    } catch (e) {
      console.warn('[Persistence] Failed to load playback state:', e);
      return defaultState;
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export default playbackPersistence;
