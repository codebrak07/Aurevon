import axios from 'axios';
import { API } from '../config/api';

function ensureArray(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }
  }
  return [];
}

function normalizeShuffleQueries(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload
      .flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (Array.isArray(item)) {
          return item.filter((entry) => typeof entry === 'string');
        }
        if (item && typeof item === 'object') {
          if (typeof item.query === 'string') return [item.query];
          if (typeof item.title === 'string') {
            return [`${item.title}${item.artist ? ` ${item.artist}` : ''}`.trim()];
          }
        }
        return [];
      })
      .filter(Boolean);
  }

  if (typeof payload === 'object') {
    for (const key of ['queries', 'songs', 'tracks', 'results']) {
      const normalized = normalizeShuffleQueries(payload[key]);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return [];
}

// ── EXPORTS USED BY COMPONENTS ──

export async function generateSmartShuffle(contextData) {
  try {
    const prompt = `You are building the next songs for a music session.
Context: ${JSON.stringify(contextData)}
Return ONLY JSON.
Format: an array of 5 to 10 search query strings like ["Blinding Lights The Weeknd", "Midnight City M83"].

CRITICAL RULE: DO NOT TRANSLATE song titles. Keep Hindi/Indian songs in their original transliterated titles (e.g. "Pehle Bhi Main", "Tum Hi Ho"). Do not return indices or explanations.`;
    
    const res = await axios.post(API('/ai/shuffle'), { prompt });
    return normalizeShuffleQueries(ensureArray(res.data));
  } catch { return []; }
}

export async function getSmartRecommendations(contextData) {
  try {
    const systemPrompt = `You are a musical recommendation engine. 
    IMPORTANT: DO NOT TRANSLATE song titles or artist names. Keep Hindi songs in their original transliterated titles.
    Return a JSON object with 'songs' array (title, artist, reason) and UI text labels.`;
    
    const res = await axios.post(API('/ai/recommendations'), {
      prompt: JSON.stringify(contextData),
      systemPrompt
    });
    return res.data;
  } catch { return null; }
}

export async function generateMagicSeeds(prompt) {
  try {
    const res = await axios.post(API('/ai/magic-seeds'), { prompt });
    return ensureArray(res.data);
  } catch { return []; }
}

export async function refineSongPrompt(idea) {
  try {
    const res = await axios.post(API('/ai/refine'), { idea });
    return res.data;
  } catch { return { title: idea, tags: '', prompt: idea }; }
}

export async function generateTopMixes(likedSongs = [], history = []) {
  try {
    const seeds = likedSongs.length > 0 ? likedSongs.slice(0, 5).map(s => s.title).join(', ') : 'Popular music';
    const prompt = `Based on these liked tracks: ${seeds}, provide 4 personalized mix categories (e.g. "Chill Lo-fi", "Deep Techno"). Return ONLY a JSON array of strings.`;
    
    const res = await axios.post(API('/ai/top-mixes'), { prompt });
    return ensureArray(res.data);
  } catch {
    return ["My Daily Mix", "Discovery", "Electronic", "Focus"];
  }
}

// Ensure compatibility with varied import names
export const getRecommendations = getSmartRecommendations;

const aiService = {
  generateSmartShuffle,
  getSmartRecommendations,
  generateMagicSeeds,
  refineSongPrompt,
  generateTopMixes,
  getRecommendations
};

export default aiService;
