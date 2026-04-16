import cacheService from './cacheService';

// ═══════════════════════════════════════════════
// AI SERVICE — Smart Shuffle Engine
// Gemini (primary) → Groq Primary (secondary) → Groq Secondary (fallback) → Static fallback
// ═══════════════════════════════════════════════

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_KEY_SECONDARY = import.meta.env.VITE_GROQ_API_KEY_SECONDARY;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// ── Helpers ──

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function cleanJSON(text) {
  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON array from response
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    // Try to extract JSON object
    const objMatch = text.match(/\{[\s\S]*?\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
    }
    throw new Error('Could not parse AI response as JSON');
  }
}

// ── Build the Smart Shuffle Prompt ──

function getSmartShufflePrompt({
  currentSong,
  listenPercent,
  skippedEarly,
  sessionHistory,
  sessionMood,
  timeOfDay,
}) {
  const historyStr = sessionHistory.length > 0
    ? sessionHistory
        .map((h, i) => `${i + 1}. "${h.track.title}" by ${h.track.artist} — ${h.label} (${Math.round((h.percentListened || 0) * 100)}% listened)`)
        .join('\n')
    : 'No history yet';

  const recentGenresStr = sessionMood.recentGenres?.length > 0
    ? sessionMood.recentGenres.join(', ')
    : 'mixed';

  return `🔥 SMART SHUFFLE — Generate 5 pure song queries for the next tracks.

## CURRENT SONG
- Title: ${currentSong.title}
- Artist: ${currentSong.artist}
- Genre: ${currentSong.genre || 'unknown'}

## USER BEHAVIOR
- Listen Percentage: ${Math.round(listenPercent * 100)}%
- Skipped Early: ${skippedEarly ? 'YES' : 'NO'}

## SESSION HISTORY (last 5 songs):
${historyStr}

## SESSION MOOD
- Time of Day: ${timeOfDay}
- Recent Genres: ${recentGenresStr}
- Skip Rate: ${sessionMood.skipRate || 0}%
- Energy Level: ${sessionMood.avgEnergy || 'medium'}

## RULES
1. If user SKIPPED EARLY (<20% listened): shift genre/mood away from current song. User wasn't feeling it.
2. If user LISTENED FULLY (>80%): stay in the same vibe. User loved it.
3. If skip rate is HIGH (>40%): reset — try a completely different genre direction.
4. Match the time of day (morning=upbeat/fresh, afternoon=energetic, evening=chill/warm, night=mellow/atmospheric).
5. NEVER repeat songs from the session history.
6. Create smooth mood transitions — don't jump genres abruptly.
7. Each query MUST be a pure, clean search string for a specific song exactly identical to: "SongTitle ArtistName". Do NOT add words like "official audio", "music video", or "lyrics".
8. Vary artists. The music taste MUST be absolutely GOATED — highly acclaimed, iconic, or deeply loved tracks that represent the peak of this user's current vibe.

## OUTPUT FORMAT (STRICT — JSON ARRAY ONLY)
["Song1 Artist1", "Song2 Artist2", "Song3 Artist3", "Song4 Artist4", "Song5 Artist5"]

Respond with ONLY the JSON array. No explanation, no markdown.`;
}

// ── Call Gemini API ──

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) return null;

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 512,
      },
    }),
  });

  if (response.status === 429) {
    console.warn('[AI] Gemini quota exceeded, falling back to Deepseek/Groq...');
    return null;
  }

  if (!response.ok) {
    console.warn(`[AI] Gemini error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return cleanJSON(text);
}

// ── Call Groq API ──

async function callGroq(prompt, systemContent = 'You are a music recommendation AI. You output ONLY valid JSON arrays of YouTube search queries. No explanations.', apiKey = GROQ_API_KEY) {
  if (!apiKey) return null;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    console.warn(`[AI] Groq error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return cleanJSON(text);
}

// ── Static Fallback Queries ──

function getStaticFallback(currentSong, timeOfDay) {
  return [
    `${currentSong.title} ${currentSong.artist}`,
    `${currentSong.artist} popular songs`,
    `${timeOfDay} playlist ${currentSong.genre || 'hits'}`,
    `top hits 2024`,
    `trending ${currentSong.genre || 'music'} songs`,
  ];
}

function extractQueries(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed.queries && Array.isArray(parsed.queries)) return parsed.queries;
  if (parsed.songs && Array.isArray(parsed.songs)) return parsed.songs;
  return null;
}

// ═══════════════════════════════════════════════
// MAIN EXPORT: generateSmartShuffle
// ═══════════════════════════════════════════════

export async function generateSmartShuffle({
  currentSong,
  listenPercent = 1,
  skippedEarly = false,
  sessionHistory = [],
  sessionMood = {},
  timeOfDay = null,
}) {
  if (!currentSong || !currentSong.title) {
    return getStaticFallback({ title: 'music', artist: '', genre: '' }, getTimeOfDay());
  }

  const tod = timeOfDay || getTimeOfDay();

  // ── Check cache first ──
  const cacheKey = `ai_shuffle:${currentSong.title}:${currentSong.artist}:${skippedEarly}`;
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) {
    console.log('[AI] Using cached shuffle queries');
    return cached;
  }

  // ── Build prompt ──
  const prompt = getSmartShufflePrompt({
    currentSong,
    listenPercent,
    skippedEarly,
    sessionHistory,
    sessionMood,
    timeOfDay: tod,
  });

  let queries = null;

  // ── Layer 1: Gemini ──
  try {
    const result = await callGemini(prompt);
    if (Array.isArray(result) && result.length >= 3) {
      queries = result.slice(0, 5).map(q => String(q).trim());
      console.log('[AI] Gemini returned queries:', queries);
    }
  } catch (err) {
    console.warn('[AI] Gemini failed:', err.message);
  }

  // ── Layer 2: Groq Primary Fallback ──
  if (!queries) {
    try {
      const result = await callGroq(prompt);
      const extracted = extractQueries(result);
      if (Array.isArray(extracted) && extracted.length >= 3) {
        queries = extracted.slice(0, 5).map(q => String(q).trim());
        console.log('[AI] Groq Primary returned queries:', queries);
      }
    } catch (err) {
      console.warn('[AI] Groq Primary failed:', err.message);
    }
  }

  // ── Layer 3: Groq Secondary Fallback ──
  if (!queries && GROQ_API_KEY_SECONDARY) {
    try {
      const result = await callGroq(prompt, undefined, GROQ_API_KEY_SECONDARY);
      const extracted = extractQueries(result);
      if (Array.isArray(extracted) && extracted.length >= 3) {
        queries = extracted.slice(0, 5).map(q => String(q).trim());
        console.log('[AI] Groq Secondary returned queries:', queries);
      }
    } catch (err) {
      console.warn('[AI] Groq Secondary failed:', err.message);
    }
  }

  // ── Layer 4: Static Fallback ──
  if (!queries || queries.length === 0) {
    queries = getStaticFallback(currentSong, tod);
    console.log('[AI] Using static fallback queries');
  }

  // ── Cache the result ──
  cacheService.set('aiSuggestions', cacheKey, queries);

  return queries;
}

// ═══════════════════════════════════════════════
// SMART RECOMMENDATIONS (enhanced version for Recommendations UI)
// Returns structured data with mood/energy/reason
// ═══════════════════════════════════════════════

export async function getSmartRecommendations({
  recentTracks = [],
  repeatTrack = null,
  repeatCount = 0,
  likedSongs = [],
  listeningHistory = [],
}) {
  const currentTrack = recentTracks[0];
  if (!currentTrack) return null;

  // Build a behavior-aware cache key
  const historyHash = listeningHistory
    .slice(0, 3)
    .map(h => `${h.track.id}:${h.label}`)
    .join('_');
  const cacheKey = `smart_${currentTrack.id}_${historyHash}`;
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) return cached;

  const recentFormatted = recentTracks.length > 0
    ? recentTracks.map(t => `"${t.title}" by ${t.artist}`).join('\n')
    : 'None yet';

  const repeatFormatted = repeatTrack
    ? `"${repeatTrack.title}" by ${repeatTrack.artist}`
    : 'None';

  const likedFormatted = likedSongs.length > 0
    ? likedSongs.slice(0, 25).map(t => `"${t.title}" by ${t.artist}`).join('\n')
    : 'None yet';

  const historyFormatted = listeningHistory.length > 0
    ? listeningHistory.slice(0, 5).map(h =>
        `"${h.track.title}" by ${h.track.artist} - BEHAVIOR: ${h.label} (Listened ${Math.round((h.percentListened || 0) * 100)}%)`
      ).join('\n')
    : 'No behavior data yet';

  const systemPrompt = `You are an elite music recommendation engine inside a web music player, known for your absolute "goated" taste in music.
Your job is to suggest the next songs based on the user's current track, their liked songs, and exactly HOW they are interacting (behavioral listening history).`;

  const prompt = `---
## INPUT
Current & Recent Tracks:
${recentFormatted}

Repeated Track:
${repeatFormatted} (repeat count: ${repeatCount})

Recent Listening Behavior (CRITICAL):
${historyFormatted}

Liked Songs:
${likedFormatted}

---
## TASK
1. Detect Mood: Infer mood from the current playing track and history.
2. Analyze Behavior:
   - Strongly PREFER genres/artists of tracks marked "listened_fully" or "looped".
   - Strongly AVOID genres/vibes of tracks marked "skipped_early".
3. Recommend EXACTLY 5 songs that match current mood, adapt to recent behavior, and feel like a natural continuation. The tracks MUST be of GOATED taste, critically acclaimed, or highly beloved by fans of this exact vibe.

## OUTPUT (STRICT JSON ONLY)
{
  "mood": "...",
  "energy": "low|medium|high",
  "reason": "short explanation",
  "songs": [
    { "title": "...", "artist": "...", "query": "SongTitle ArtistName" }
  ],
  "uiText": "short text shown to user e.g. 'Keeping the chill vibes going...'"
}`;

  // Gemini → Groq Primary → Groq Secondary → null
  let result = null;

  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        result = cleanJSON(text);
      } else if (response.status === 429) {
        console.warn('[AI] Gemini quota exceeded for recs, trying Deepseek/Groq...');
      }
    } catch (err) {
      console.warn('[AI] Gemini recs failed:', err.message);
    }
  }

  if (!result) {
    try {
      result = await callGroq(prompt, systemPrompt);
      if (result) console.log('[AI] Groq Primary returned recommendations');
    } catch (err) {
      console.warn('[AI] Groq Primary recs failed:', err.message);
    }
  }

  if (!result && GROQ_API_KEY_SECONDARY) {
    try {
      result = await callGroq(prompt, systemPrompt, GROQ_API_KEY_SECONDARY);
      if (result) console.log('[AI] Groq Secondary returned recommendations');
    } catch (err) {
      console.warn('[AI] Groq Secondary recs failed:', err.message);
    }
  }

  if (!result || !result.songs || !Array.isArray(result.songs)) {
    throw new Error('No AI provider returned valid recommendations');
  }

  const finalResult = {
    mood: String(result.mood || 'chill'),
    energy: String(result.energy || 'medium'),
    reason: String(result.reason || ''),
    uiText: String(result.uiText || 'Continuing your vibe...'),
    songs: result.songs
      .filter(s => s.title && s.artist)
      .slice(0, 5)
      .map(s => ({
        title: String(s.title).trim(),
        artist: String(s.artist).trim(),
        query: String(s.query || `${s.title} ${s.artist}`).trim(),
      })),
  };

  cacheService.set('aiSuggestions', cacheKey, finalResult);
  return finalResult;
}

// ═══════════════════════════════════════════════
// MAGIC VIBE — mood-based playlist generation
// ═══════════════════════════════════════════════

export async function generateMagicSeeds(prompt, likedSongs = []) {
  const cacheKey = `magic_${prompt.trim().toLowerCase()}`;
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) return cached;

  const tasteProfile = likedSongs
    .slice(0, 20)
    .map(s => `"${s.title}" by ${s.artist}`)
    .join(', ');

  const systemPrompt = tasteProfile
    ? `You are a music recommendation expert. The user has these songs in their library: ${tasteProfile}. Based on their taste AND their mood request, suggest 8 songs that bridge their preferences with their current mood.`
    : `You are a music recommendation expert. Suggest 8 diverse, high-quality songs based on the mood request.`;

  const userPrompt = `My mood/request: "${prompt}"

IMPORTANT: Respond ONLY with a valid JSON array of songs.
Example: [{"title":"Song Name","artist":"Artist Name"}]`;

  let result = null;

  // Gemini
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        result = cleanJSON(text);
      }
    } catch (err) {
      console.warn('[AI] Magic vibe Gemini failed:', err.message);
    }
  }

  // Groq primary fallback
  if (!result) {
    try {
      result = await callGroq(userPrompt, systemPrompt);
    } catch (err) {
      console.warn('[AI] Magic vibe Groq Primary failed:', err.message);
    }
  }

  // Groq secondary fallback
  if (!result && GROQ_API_KEY_SECONDARY) {
    try {
      result = await callGroq(userPrompt, systemPrompt, GROQ_API_KEY_SECONDARY);
    } catch (err) {
      console.warn('[AI] Magic vibe Groq Secondary failed:', err.message);
    }
  }

  if (!result) throw new Error('No AI provider available');

  const songs = (Array.isArray(result) ? result : result.songs || [])
    .filter(s => s.title && s.artist)
    .slice(0, 8)
    .map(s => ({
      title: String(s.title).trim(),
      artist: String(s.artist).trim(),
    }));

  if (songs.length > 0) {
    cacheService.set('aiSuggestions', cacheKey, songs);
  }
  return songs;
}

// ═══════════════════════════════════════════════
// GENERATE TOP MIXES — personalized home screen carousels
// ═══════════════════════════════════════════════

export async function generateTopMixes(likedSongs = []) {
  if (!likedSongs.length) return null;

  const cacheKey = 'personalized_top_mixes';
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) return cached;

  const tasteProfile = likedSongs
    .slice(0, 30)
    .map(s => `"${s.title}" by ${s.artist}`)
    .join(', ');

  const systemPrompt = `You are a music curator. Analyze the user's library and generate 5 unique, creative "Mixes" (playlists).
Each mix should have a cool, thematic title (not just "Genre Mix"), a descriptive subtitle listing some artists/vibes, and a specific AI prompt for Magic Vibe.`;

  const userPrompt = `My music library sample: ${tasteProfile}

TASK: Generate 5 personalized mixes.
OUTPUT: Respond ONLY with a valid JSON array of 5 objects:
[
  {
    "title": "Mix Title (e.g., 'Midnight Echoes')",
    "subtitle": "Subtitle (e.g., 'Chill Indie, Lofi Beats')",
    "prompt": "Detailed AI prompt for Magic Vibe",
    "color": "Hex color for background vibe (e.g., '#2a4a3a')"
  }
]`;

  let result = null;

  // Layer 1: Gemini
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        result = cleanJSON(text);
      }
    } catch (err) {
      console.warn('[AI] Top Mixes Gemini failed:', err.message);
    }
  }

  // Layer 2: Groq Primary Fallback
  if (!result) {
    try {
      result = await callGroq(userPrompt, systemPrompt);
    } catch (err) {
      console.warn('[AI] Top Mixes Groq Primary failed:', err.message);
    }
  }

  // Layer 3: Groq Secondary Fallback
  if (!result && GROQ_API_KEY_SECONDARY) {
    try {
      result = await callGroq(userPrompt, systemPrompt, GROQ_API_KEY_SECONDARY);
    } catch (err) {
      console.warn('[AI] Top Mixes Groq Secondary failed:', err.message);
    }
  }

  if (!result || !Array.isArray(result)) {
    return null; // Let the component handle the static fallback
  }

  const finalMixes = result.slice(0, 5).map(m => ({
    title: String(m.title || 'Personal Mix').trim(),
    subtitle: String(m.subtitle || 'Custom vibe for you').trim(),
    prompt: String(m.prompt || m.title).trim(),
    color: String(m.color || '#1a1a1a').trim(),
    image: `https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300` // Placeholder abstract art
  }));

  cacheService.set('aiSuggestions', cacheKey, finalMixes);
  return finalMixes;
}

