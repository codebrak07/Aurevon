import cacheService from './cacheService';

/**
 * ═══════════════════════════════════════════════
 * MOOD SERVICE — Music Taste Analysis & Clustering
 * ═══════════════════════════════════════════════
 */

const ITUNES_URL = 'https://itunes.apple.com/search';

// Standard Mood Clusters with Icons and AI Prompts
const MOOD_CLUSTERS = {
  Chill: { 
    icon: '🌅', 
    keywords: ['lo-fi', 'ambient', 'acoustic', 'chill', 'relax', 'mellow', 'soul', 'r&b'], 
    prompt: 'relaxing evening music, calm and warm' 
  },
  Energy: { 
    icon: '🔥', 
    keywords: ['rock', 'metal', 'edm', 'energy', 'workout', 'hype', 'fast', 'electronic', 'dance'], 
    prompt: 'high energy workout music, intense and motivating' 
  },
  Focus: { 
    icon: '🧠', 
    keywords: ['classical', 'instrumental', 'piano', 'study', 'focus', 'concentration', 'jazz'], 
    prompt: 'lo-fi beats, concentration music for deep work' 
  },
  Party: { 
    icon: '🎉', 
    keywords: ['pop', 'reggaeton', 'latin', 'party', 'hits', 'club', 'vibrant'], 
    prompt: 'upbeat party hits, feel good dance music' 
  },
  Sad: { 
    icon: '🌧️', 
    keywords: ['sad', 'emotional', 'ballad', 'melancholy', 'rainy', 'blues'], 
    prompt: 'cozy rainy day music, mellow and atmospheric' 
  },
  Romantic: { 
    icon: '❤️', 
    keywords: ['romantic', 'love', 'date', 'sweet', 'slow', 'duet'], 
    prompt: 'romantic acoustic songs, soft and intimate vibe' 
  },
  Nature: {
    icon: '🌲',
    keywords: ['folk', 'indie', 'nature', 'acoustic', 'forest', 'earthy'],
    prompt: 'earthy indie folk, acoustic and natural vibes'
  }
};

const DEFAULT_MOODS = [
  { label: 'Chill', icon: '🌅', prompt: MOOD_CLUSTERS.Chill.prompt },
  { label: 'Energy', icon: '🔥', prompt: MOOD_CLUSTERS.Energy.prompt },
  { label: 'Focus', icon: '🧠', prompt: MOOD_CLUSTERS.Focus.prompt },
];

/**
 * Fetch genre for a track from iTunes API
 */
async function fetchGenreFromITunes(title, artist) {
  const cacheKey = `genre:${title}:${artist}`.toLowerCase();
  const cached = cacheService.get('artistData', cacheKey);
  if (cached) return cached;

  try {
    const isProd = import.meta.env.PROD;
    const term = `${title} ${artist}`;
    const searchUrl = isProd 
      ? `/api/search/itunes?term=${encodeURIComponent(term)}&entity=song&limit=1`
      : `${ITUNES_URL}?term=${encodeURIComponent(term)}&entity=song&limit=1`;

    const response = await fetch(searchUrl);
    if (!response.ok) return null;
    
    const data = await response.json();
    const genre = data.results?.[0]?.primaryGenreName;
    
    if (genre) {
      cacheService.set('artistData', cacheKey, genre);
      return genre;
    }
  } catch (err) {
    console.warn(`[MoodService] iTunes fetch failed for ${title}:`, err);
  }
  return null;
}

/**
 * Maps a genre or keyword to a mood label
 */
function mapGenreToMood(genre) {
  if (!genre) return 'Chill';
  const g = genre.toLowerCase();
  
  for (const [mood, config] of Object.entries(MOOD_CLUSTERS)) {
    if (config.keywords.some(keyword => g.includes(keyword))) {
      return mood;
    }
  }
  return 'Chill'; // Default
}

/**
 * Extract moods from a list of tracks
 */
async function analyzeTracks(tracks) {
  const moodCounts = {};
  
  // Take a sample of up to 20 tracks for analysis
  const sample = tracks.slice(0, 20);
  
  const analysisPromises = sample.map(async (track) => {
    let genre = track.genre;
    if (!genre) {
      genre = await fetchGenreFromITunes(track.title, track.artist);
    }
    const mood = mapGenreToMood(genre);
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
  });

  await Promise.all(analysisPromises);
  return moodCounts;
}

/**
 * Main Export: Generate personalized moods based on user taste
 */
export async function getPersonalizedMoods(likedSongs = [], history = [], playlists = []) {
  // Check if we have enough data to personalize
  const totalSongs = likedSongs.length + history.length;
  if (totalSongs < 5) {
    return DEFAULT_MOODS;
  }

  // Check 24h cache for personalized moods
  const cacheKey = 'personalized_mood_buttons';
  const cached = cacheService.get('aiSuggestions', cacheKey);
  if (cached) return cached;

  try {
    // Combine liked songs and history (give weight to liked)
    const allTracks = [...likedSongs, ...history.map(h => h.track || h)];
    const moodCounts = await analyzeTracks(allTracks);

    // Sort by frequency and pick top 4-6
    const sortedMoods = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([mood]) => ({
        label: mood,
        icon: MOOD_CLUSTERS[mood]?.icon || '✨',
        prompt: MOOD_CLUSTERS[mood]?.prompt || `music with ${mood} vibe`
      }))
      .slice(0, 6);

    const finalMoods = sortedMoods.length >= 3 ? sortedMoods : DEFAULT_MOODS;

    // Cache for 24h
    cacheService.set('aiSuggestions', cacheKey, finalMoods);
    return finalMoods;
  } catch (err) {
    console.error('[MoodService] Personalization failed:', err);
    return DEFAULT_MOODS;
  }
}
