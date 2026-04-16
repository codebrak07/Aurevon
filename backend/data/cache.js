// backend/data/cache.js
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'youtubeCache.json');
const CACHE_TTL = 86400000; // 24 hours in milliseconds

// Initial load from file
let cache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = fs.readFileSync(CACHE_FILE, 'utf-8');
    cache = JSON.parse(data);
    console.log('✅ Persistent cache loaded from youtubeCache.json');
    // Basic cleanup on load
    Object.keys(cache).forEach(key => {
      if (Date.now() - cache[key].timestamp >= CACHE_TTL) {
        delete cache[key];
      }
    });
  }
} catch (error) {
  console.warn('⚠️ Could not load cache file:', error.message);
}

const normalizeQuery = (query) => {
  return query.toLowerCase().trim();
};

const saveCache = async () => {
  try {
    await fs.promises.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.warn('⚠️ Could not save to cache file:', error.message);
  }
};

const getFromCache = (query) => {
  const normalized = normalizeQuery(query);
  const cachedItem = cache[normalized];
  if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL) {
    return cachedItem.data;
  }
  return null;
};

const setInCache = async (query, data) => {
  const normalized = normalizeQuery(query);
  cache[normalized] = {
    timestamp: Date.now(),
    data: data
  };
  await saveCache();
};

// Periodic Cleanup every hour
setInterval(async () => {
  console.log('🧹 Running cache cleanup...');
  let deletedCount = 0;
  Object.keys(cache).forEach(key => {
    if (Date.now() - cache[key].timestamp >= CACHE_TTL) {
      delete cache[key];
      deletedCount++;
    }
  });
  if (deletedCount > 0) {
    console.log(`🧹 Deleted ${deletedCount} expired cache entries.`);
    await saveCache();
  }
}, 3600000); // 1 hour

module.exports = {
  getFromCache,
  setInCache,
  normalizeQuery
};

