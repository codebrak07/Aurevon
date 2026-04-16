// ═══════════════════════════════════════════════
// CACHE SERVICE — LRU Cache with localStorage persistence
// Namespaces: search, videoMap, aiSuggestions, audioFeatures, artistData, recommendations
// Max 50 items per namespace
// ═══════════════════════════════════════════════

const MAX_ITEMS = 50;
const TTL = 24 * 60 * 60 * 1000; // 1 day in milliseconds

class CacheService {
  constructor() {
    this.store = {
      search: new Map(),
      videoMap: new Map(),
      aiSuggestions: new Map(),
      recommendations: new Map(),
      audioFeatures: new Map(),
      artistData: new Map(),
      categoryResults: new Map(),
    };
    this._loadFromStorage();
  }

  _loadFromStorage() {
    try {
      const saved = localStorage.getItem('wavify_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach((ns) => {
          if (this.store[ns]) {
            const entries = parsed[ns];
            entries.forEach(([key, entry]) => {
              // Backward compatibility: check if entry is just the value
              const value = entry && entry.value !== undefined ? entry.value : entry;
              const timestamp = entry && entry.timestamp !== undefined ? entry.timestamp : Date.now();
              this.store[ns].set(key, { value, timestamp });
            });
          }
        });
      }
    } catch {
      // ignore corrupt cache
    }
  }

  _saveToStorage() {
    try {
      const serializable = {};
      Object.keys(this.store).forEach((ns) => {
        serializable[ns] = Array.from(this.store[ns].entries());
      });
      localStorage.setItem('wavify_cache', JSON.stringify(serializable));
    } catch {
      // storage full — clear old data and try again
      try {
        localStorage.removeItem('wavify_cache');
      } catch { /* ignore */ }
    }
  }

  _evictIfNeeded(namespace) {
    const map = this.store[namespace];
    while (map && map.size >= MAX_ITEMS) {
      const firstKey = map.keys().next().value;
      map.delete(firstKey);
    }
  }

  get(namespace, key) {
    const map = this.store[namespace];
    if (!map) return null;
    if (map.has(key)) {
      const entry = map.get(key);
      const now = Date.now();

      // Check for expiration
      if (now - entry.timestamp > TTL) {
        map.delete(key);
        this._saveToStorage();
        return null;
      }

      // LRU: move to end
      map.delete(key);
      map.set(key, entry);
      return entry.value;
    }
    return null;
  }

  set(namespace, key, value) {
    if (!this.store[namespace]) {
      this.store[namespace] = new Map();
    }
    const map = this.store[namespace];
    if (map.has(key)) {
      map.delete(key);
    }
    this._evictIfNeeded(namespace);
    map.set(key, { value, timestamp: Date.now() });
    this._saveToStorage();
  }

  has(namespace, key) {
    return this.store[namespace]?.has(key) || false;
  }

  clear(namespace) {
    if (this.store[namespace]) {
      this.store[namespace].clear();
      this._saveToStorage();
    }
  }

  clearAll() {
    Object.keys(this.store).forEach(ns => this.store[ns].clear());
    try { localStorage.removeItem('wavify_cache'); } catch { /* ignore */ }
  }
}

const cacheService = new CacheService();
export default cacheService;
