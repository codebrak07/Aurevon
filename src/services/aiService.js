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
    const prompt = `Based on these tracks: ${JSON.stringify(contextData)}... Recommend a smart shuffle order for the following 20 tracks. Return ONLY a JSON array of indices.`;
    return await callGemini(prompt) || await callGroq(prompt, 'Return JSON array of indices') || [];
  } catch { return []; }
}

export async function getSmartRecommendations(contextData) {
  try {
    const systemPrompt = "You are a musical recommendation engine. Return a JSON object with 'songs' array (title, artist, reason) and UI text labels.";
    return await callGemini(`${systemPrompt}\n\n${JSON.stringify(contextData)}`) || await callGroq(JSON.stringify(contextData), systemPrompt) || null;
  } catch { return null; }
}

export async function generateMagicSeeds(prompt) {
  try {
    const systemPrompt = "You are a musical vibe expert. Given a mood or memory, provide 5 specific song queries (Artist - Title) that represent that feeling. Return ONLY a JSON array of strings.";
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
