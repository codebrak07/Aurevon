import axios from 'axios';
import cacheService from './cacheService';

// ═══════════════════════════════════════════════
// AI SERVICE — Final Universal Integration
// Includes all functions for TopMixes, MagicVibe, and PlayerContext
// ═══════════════════════════════════════════════

const getApiKey = (key) => import.meta.env[key] || '';

const GEMINI_URL = () => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${getApiKey('VITE_GEMINI_API_KEY')}`;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function cleanJSON(text) {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const match = text.match(/\{[\s\S]*?\}/) || text.match(/\[[\s\S]*?\]/);
    if (match) { try { return JSON.parse(match[0]); } catch { } }
    return null;
  }
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

async function callGemini(prompt) {
  try {
    const url = GEMINI_URL();
    if (!url.includes('AIza')) return null;
    const response = await axios.post(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return cleanJSON(response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
  } catch (err) {
    return null;
  }
}

async function callGroq(prompt, systemContent, apiKey = getApiKey('VITE_GROQ_API_KEY')) {
  if (!apiKey) return null;
  try {
    const response = await axios.post(GROQ_URL, {
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: systemContent }, { role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    }, { headers: { Authorization: `Bearer ${apiKey}` } });
    return cleanJSON(response.data?.choices?.[0]?.message?.content || '');
  } catch (err) {
    return null;
  }
}

// ── EXPORTS USED BY COMPONENTS ──

export async function generateSmartShuffle(contextData) {
  try {
    const prompt = `You are building the next songs for a music session.
Context: ${JSON.stringify(contextData)}
Return ONLY JSON.
Format: an array of 5 to 10 search query strings like ["Blinding Lights The Weeknd", "Midnight City M83"].

CRITICAL RULE: DO NOT TRANSLATE song titles. Keep Hindi/Indian songs in their original transliterated titles (e.g. "Pehle Bhi Main", "Tum Hi Ho"). Do not return indices or explanations.`;
    const result =
      await callGemini(prompt) ||
      await callGroq(prompt, 'Return only a JSON array of music search query strings. No translations.') ||
      [];
    return normalizeShuffleQueries(result);
  } catch { return []; }
}

export async function getSmartRecommendations(contextData) {
  try {
    const systemPrompt = `You are a musical recommendation engine. 
    IMPORTANT: DO NOT TRANSLATE song titles or artist names. Keep Hindi songs in their original transliterated titles.
    Return a JSON object with 'songs' array (title, artist, reason) and UI text labels.`;
    return await callGemini(`${systemPrompt}\n\n${JSON.stringify(contextData)}`) || await callGroq(JSON.stringify(contextData), systemPrompt) || null;
  } catch { return null; }
}

export async function generateMagicSeeds(prompt) {
  try {
    const systemPrompt = `You are a musical vibe expert. Given a mood or memory, provide 5 specific song queries (Artist - Title) that represent that feeling. 
    RULE: DO NOT TRANSLATE song titles. Keep Indian music in original transliterated titles.
    Return ONLY a JSON array of strings.`;
    return await callGemini(`${systemPrompt}\n\n${prompt}`) || await callGroq(prompt, systemPrompt) || [];
  } catch { return []; }
}

export async function refineSongPrompt(idea) {
  try {
    const systemPrompt = 'Respond with ONLY JSON: { "title": "...", "tags": "...", "prompt": "..." }';
    return await callGroq(`Refine: ${idea}`, systemPrompt) || { title: idea, tags: '', prompt: idea };
  } catch { return { title: idea, tags: '', prompt: idea }; }
}

export async function generateTopMixes(likedSongs = [], history = []) {
  try {
    const seeds = likedSongs.length > 0 ? likedSongs.slice(0, 5).map(s => s.title).join(', ') : 'Popular music';
    const prompt = `Based on these liked tracks: ${seeds}, provide 4 personalized mix categories (e.g. "Chill Lo-fi", "Deep Techno"). Return ONLY a JSON array of strings.`;
    return await callGemini(prompt) || await callGroq(prompt, 'Return JSON array of strings') || ["My Daily Mix", "Discovery", "Electronic", "Focus"];
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
