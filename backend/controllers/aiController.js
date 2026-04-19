const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_KEY_SECONDARY = process.env.GROQ_API_KEY_SECONDARY;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
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
  if (!GEMINI_API_KEY) return null;
  const response = await axios.post(GEMINI_URL, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
  });
  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return cleanJSON(text);
}

async function callGroq(prompt, systemContent = 'You are an AI assistant. Return JSON.', apiKey = GROQ_API_KEY) {
  if (!apiKey) return null;
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
    
    let result = null;
    try {
      result = await callGroq(`Refine this song idea: "${idea}"`, systemPrompt);
    } catch (e) {
      console.warn('[AI PROXY] Groq primary failed, trying secondary...');
      result = await callGroq(`Refine this song idea: "${idea}"`, systemPrompt, GROQ_API_KEY_SECONDARY);
    }

    res.json(result);
  } catch (error) {
    console.error('[AI PROXY] Refine error:', error.message);
    res.status(500).json({ message: 'AI refinement failed' });
  }
};

const getRecommendations = async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    
    let result = null;
    try {
      result = await callGemini(`${systemPrompt}\n\n${prompt}`);
    } catch (e) {
      console.warn('[AI PROXY] Gemini failed for recs, trying Groq...');
      result = await callGroq(prompt, systemPrompt);
    }

    if (!result) {
      result = await callGroq(prompt, systemPrompt, GROQ_API_KEY_SECONDARY);
    }

    res.json(result);
  } catch (error) {
    console.error('[AI PROXY] Recommendation error:', error.message);
    res.status(500).json({ message: 'AI recommendations failed' });
  }
};

const smartShuffle = async (req, res) => {
    try {
      const { prompt } = req.body;
      let result = null;
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
    
    let result = null;
    try {
      result = await callGemini(`${systemPrompt}\n\n${prompt}`);
    } catch (e) {
      result = await callGroq(prompt, systemPrompt);
    }
    res.json(result);
  } catch (error) {
    console.error('[AI PROXY] Magic seeds error:', error.message);
    res.status(500).json({ message: 'Magic seeds generation failed' });
  }
}

module.exports = {
  refinePrompt,
  getRecommendations,
  smartShuffle,
  magicSeeds
};
