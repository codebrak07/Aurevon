const axios = require('axios');

// Load multiple keys for rotation (Failover)
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_SECONDARY,
].filter(Boolean);

const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_SECONDARY,
].filter(Boolean);

let geminiCounter = 0;
let groqCounter = 0;

function getGeminiUrl() {
  const key = GEMINI_KEYS[geminiCounter % GEMINI_KEYS.length];
  geminiCounter++;
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
}

function getGroqKey() {
  const key = GROQ_KEYS[groqCounter % GROQ_KEYS.length];
  groqCounter++;
  return key;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

function cleanJSON(text) {
  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { }
    }
    const objMatch = text.match(/\{[\s\S]*?\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { }
    }
    throw new Error('Could not parse AI response as JSON');
  }
}

async function callGemini(prompt) {
  if (GEMINI_KEYS.length === 0) throw new Error('No Gemini API keys available');
  const url = getGeminiUrl();
  const response = await axios.post(url, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
  });
  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return cleanJSON(text);
}

async function callGroq(prompt, systemContent = 'You are an AI assistant. Return JSON.') {
  if (GROQ_KEYS.length === 0) throw new Error('No Groq API keys available');
  const apiKey = getGroqKey();
  const response = await axios.post(GROQ_URL, {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.85
  }, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const text = response.data?.choices?.[0]?.message?.content || '';
  return cleanJSON(text);
}

// ── ENDPOINTS ──

const refinePrompt = async (req, res) => {
  try {
    const { idea } = req.body;
    const systemPrompt = `You are a professional music producer and lyricist. 
Take a simple idea and turn it into a Suno AI prompt.
Respond with ONLY JSON: { "title": "...", "tags": "...", "prompt": "..." }`;
    
    let result = await callGroq(`Refine this song idea: "${idea}"`, systemPrompt);
    res.json(result);
  } catch (error) {
    console.error('[AI PROXY] Refine error:', error.message);
    res.status(500).json({ message: 'AI refinement failed' });
  }
};

/**
 * Magic Vibe v2: Structured playlist generation
 */
const magicVibeV2 = async (req, res) => {
  try {
    const { mood, genre, language, referenceSongs } = req.body;
    
    const prompt = `Act as a world-class AI DJ with real-time access to global musical trends and internet search knowledge.
    Create a highly personalized "vibe" playlist based on these criteria:
    - Target Mood: ${mood || 'Any'}
    - Target Genre: ${genre || 'Any'}
    - Preferred Language: ${language || 'Any (English/Hindi)'}
    - Aesthetic Reference: ${referenceSongs || 'Modern trending tracks'}

    You must return a curated list of exactly 15 songs that perfectly match this vibe. 
    Mix some well-known hits with recent trending masterpieces.
    
    IMPORTANT RULES:
    - DO NOT TRANSLATE song titles or artist names. 
    - Keep Hindi songs (e.g., Arijit Singh, Pritam) in their original transliterated titles (e.g., "Pehle Bhi Main" instead of "Every Moment Feels Like Heaven").
    - If the user specifies Hindi or Indian artists, ensure the titles reflect the actual released names.
    
    Respond with ONLY a JSON array of objects: 
    [ { "title": "Song Name", "artist": "Artist Name" }, ... ]`;

    let result;
    try {
      result = await callGemini(prompt);
    } catch (e) {
      console.warn('[AI] Gemini failed for MagicVibeV2, falling back to Groq...');
      result = await callGroq(prompt, "You are a professional Music Vibe DJ. Respond with JSON array.");
    }

    res.json(result);
  } catch (error) {
    console.error('[AI] MagicVibeV2 error:', error.message);
    res.status(500).json({ message: 'Failed to generate vibe playlist' });
  }
};

const getRecommendations = async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    let result;
    try {
      result = await callGemini(`${systemPrompt}\n\n${prompt}`);
    } catch (e) {
      result = await callGroq(prompt, systemPrompt);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'AI recommendations failed' });
  }
};

const smartShuffle = async (req, res) => {
  try {
    const { prompt } = req.body;
    let result;
    try {
      result = await callGemini(prompt);
    } catch (e) {
      result = await callGroq(prompt);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Smart shuffle failed' });
  }
}

const magicSeeds = async (req, res) => {
  try {
    const { prompt } = req.body;
    const systemPrompt = "You are a musical vibe expert. Given a mood or memory, provide 5 specific song queries (Artist - Title) that represent that feeling. Return ONLY a JSON array of strings.";
    
    let result;
    try {
      result = await callGemini(`${systemPrompt}\n\n${prompt}`);
    } catch (e) {
      result = await callGroq(prompt, systemPrompt);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Magic seeds generation failed' });
  }
}

module.exports = {
  refinePrompt,
  getRecommendations,
  smartShuffle,
  magicSeeds,
  magicVibeV2
};
