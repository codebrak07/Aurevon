import axios from 'axios';

const LOUDLY_BASE_URL = 'https://soundtracks.loudly.com/api';

/**
 * Submits a music generation request directly to Loudly from the frontend.
 * Uses FormData as required by the Loudly API.
 */
export async function submitMusic({ prompt, duration = 60, structure = 'Classic' }) {
  const apiKey = import.meta.env.VITE_SOUNDLY_API_KEY;

  if (!apiKey) {
    throw new Error('Soundly API Key is missing. Please ensure VITE_SOUNDLY_API_KEY is in your .env file.');
  }

  try {
    // Loudly API requires multipart/form-data
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('duration', Number(duration));
    formData.append('structure_id', 0); // 0 corresponds to 'Classic' in Loudly API
    
    // Optional: add a 'test' flag if you want to test without consuming credits
    // formData.append('test', 'true');

    const response = await axios.post(`${LOUDLY_BASE_URL}/ai/prompt/songs`, formData, {
      headers: {
        'API-KEY': apiKey,
        'Accept': 'application/json',
        // Axios sets Content-Type to multipart/form-data automatically for FormData
      }
    });

    const song = response.data;
    if (song && song.id) {
      return {
        task_id: song.id.toString(),
        status: 'complete',
        clips: [{
          id: song.id.toString(),
          status: 'complete',
          audio_url: song.music_file_path,
          image_url: song.image_file_path,
          title: song.title || 'Soundly AI Track',
          duration: Math.round((song.duration || 0) / 1000)
        }]
      };
    }
  } catch (error) {
    const errorData = error.response?.data;
    console.error('[Loudly Frontend Service] Error Response:', errorData || error.message);
    
    // Extract a readable message from the Loudly error object
    const detail = errorData?.message || errorData?.error || error.message;
    throw new Error(`Soundly AI: ${detail}. (Check console for full error details)`);
  }
  
  throw new Error('Unknown error during Soundly generation');
}

/**
 * Placeholder for compatibility.
 */
export async function getFeed(taskId) {
  return [];
}
