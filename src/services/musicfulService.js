import axios from 'axios';

const MUSICFUL_BASE_URL = 'https://api.musicful.ai';

/**
 * Helper to call musicful.ai with x-api-key
 */
async function callMusicfulAPI(method, endpoint, params = {}, data = null) {
  const apiKey = import.meta.env.VITE_MUSICFUL_API_KEY;

  if (!apiKey) {
    throw new Error('Musicful API Key is missing. Please add VITE_MUSICFUL_API_KEY to your .env file.');
  }

  return axios({
    method,
    url: `${MUSICFUL_BASE_URL}${endpoint}`,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    params,
    data
  });
}

/**
 * Submits a music generation request to musicful.ai.
 */
export async function submitMusic({ title, tags, prompt, make_instrumental = false }) {
  try {
    const response = await callMusicfulAPI('post', '/v1/music/generate', {}, {
        action: 'custom',
        prompt: prompt,
        style: tags || 'acoustic, melodic',
        mv: 'MFV2.0',
        instrumental: make_instrumental ? 1 : 0,
        gender: 'male', // Default to male as per user curl example
        title: title || 'Untitled'
    });

    // Expected response: { status: 200, message: 'success', data: { task_id: '...' } }
    if (response.data?.status === 200 || response.data?.status === 'success') {
      return {
        task_id: response.data.data.task_id,
        status: 'queued'
      };
    }
    
    throw new Error(response.data?.message || 'Failed to submit Musicful generation task');
  } catch (error) {
    if (error.code === 'ERR_NETWORK') {
      console.error('[Musicful] CORS Error detected. Direct browser-to-API calls are blocked by musicful.ai.');
      throw new Error('Musicful AI: Blocked by browser CORS policy. This provider requires a backend bridge or a "CORS Unblock" browser extension to work in the frontend.');
    }
    throw new Error(error.response?.data?.message || 'Failed to submit Musicful generation task');
  }
}

/**
 * Gets the status/record info for a specific task ID from musicful.ai.
 */
export async function getFeed(taskId) {
  const idValue = Array.isArray(taskId) ? taskId[0] : taskId;
  
  try {
    const response = await callMusicfulAPI('get', '/v1/music/details', {
      task_id: idValue
    });

    if (response.data?.status === 200) {
      const taskData = response.data.data;
      // Musicful might return one or more clips
      const clips = (taskData.response_data || []).map(clip => ({
        id: clip.id || taskData.task_id,
        status: taskData.status === 'SUCCESS' || taskData.status === 'complete' ? 'complete' : taskData.status.toLowerCase(),
        audio_url: clip.audio_url,
        image_url: clip.image_url,
        title: clip.title,
        duration: clip.duration
      }));

      return clips;
    }
  } catch (error) {
    console.warn('[Musicful] Polling error:', error.message);
  }
  
  return [];
}
