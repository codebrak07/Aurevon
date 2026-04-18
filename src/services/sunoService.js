const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Uses Groq to refine a simple prompt into a Suno-optimized prompt with style and lyrics.
 * (Keeping this on frontend as it uses the Groq key which is already present for other features, 
 * but we could move it to backend later if needed).
 */
export async function refinePrompt(userInput) {
  if (!GROQ_API_KEY) throw new Error('Groq API Key missing');

  const systemContent = `You are a professional music producer and lyricist. 
Your task is to take a simple song idea and turn it into a detailed prompt for Suno AI.
Suno needs:
1. "tags": A string of style descriptions (e.g., "90s west coast hip hop, melancholic, soulful piano").
2. "prompt": A detailed description of the song or full lyrics.
3. "title": A catchy title.

Respond ONLY with a JSON object:
{
  "title": "Song Title",
  "tags": "style tags",
  "prompt": "full lyrics or detailed description"
}`;

  const userContent = `Refine this song idea: "${userInput}"`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Refinement failed');
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

/**
 * Submits a music generation request to the BACKEND proxy.
 */
export async function submitMusic({ title, tags, prompt, make_instrumental = false }) {
  const response = await fetch(`${API_URL}/suno/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      tags,
      title,
      make_instrumental
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Suno Service] Submit failed:', errorBody);
    throw new Error('Suno submission failed. Please check backend logs.');
  }

  return await response.json();
}

/**
 * Gets the status/feed for specific clip IDs via BACKEND proxy.
 */
export async function getFeed(clipIds) {
  const ids = Array.isArray(clipIds) ? clipIds.join(',') : clipIds;
  const response = await fetch(`${API_URL}/suno/feed/${ids}`);

  if (!response.ok) {
    throw new Error('Failed to fetch Suno feed from backend');
  }

  return await response.json();
}
