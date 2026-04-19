import axios from 'axios';

const SUNO_BASE_URL = 'https://api.sunoapi.org';

/**
 * Helper to call sunoapi.org with primary/secondary key fallback
 */
async function callSunoAPI(method, endpoint, params = {}, data = null) {
  const primaryKey = import.meta.env.VITE_SUNO_API_KEY;
  const secondaryKey = import.meta.env.VITE_SUNO_API_KEY_SECONDARY;

  const makeRequest = async (key) => {
    return axios({
      method,
      url: `${SUNO_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      params,
      data
    });
  };

  try {
    const response = await makeRequest(primaryKey);
    // Some providers return errors as 200 OK with a code field
    if (response.data?.code && response.data.code !== 200 && secondaryKey) {
      console.warn(`[Sunoapi.org] Primary key returned business error ${response.data.code}, trying fallback...`);
      return await makeRequest(secondaryKey);
    }
    return response;
  } catch (error) {
    const status = error.response?.status;
    console.warn(`[Sunoapi.org] Primary key failed for ${endpoint}:`, status);
    if ((status === 401 || status === 429 || status === 403) && secondaryKey) {
      console.log('[Sunoapi.org] Trying fallback key...');
      return await makeRequest(secondaryKey);
    }
    throw error;
  }
}

/**
 * Submits a music generation request to sunoapi.org.
 */
export async function submitMusic({ title, tags, prompt, make_instrumental = false }) {
  // sunoapi.org expects customMode: true if title/tags are provided
  const hasCustomData = !!(title || tags);
  
  const response = await callSunoAPI('post', '/api/v1/generate', {}, {
      prompt: prompt,
      customMode: hasCustomData,
      instrumental: !!make_instrumental,
      style: tags || '',
      title: title || 'Untitled',
      model: 'V3_5', 
      callBackUrl: 'https://webhook.site/placeholder' // Mandatory: Must be non-empty
  });

  // sunoapi.org returns { code: 200, data: { task_id: '...' }, ... }
  if (response.data?.code === 200) {
    return {
      task_id: response.data.data.task_id,
      status: 'queued'
    };
  }
  
  throw new Error(response.data?.msg || 'Failed to submit music generation task');
}

/**
 * Gets the status/record info for task IDs from sunoapi.org.
 */
export async function getFeed(taskIds) {
  const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
  let allClips = [];

  for (const taskId of ids) {
    try {
      const response = await callSunoAPI('get', '/api/v1/generate/record-info', {
        taskId: taskId
      });

      if (response.data?.code === 200) {
        const taskData = response.data.data;
        const clips = (taskData.response_data || []).map(clip => ({
          id: clip.id || taskData.task_id,
          status: taskData.status === 'SUCCESS' ? 'complete' : taskData.status.toLowerCase(),
          audio_url: clip.audio_url,
          image_url: clip.image_url,
          title: clip.title,
          duration: clip.duration
        }));
        allClips = [...allClips, ...clips];
      } else if (response.data?.code === 400) {
        console.warn(`[Suno] Task ${taskId} returned 400: ${response.data.msg || 'Invalid task ID'}`);
      }
    } catch (error) {
      console.error(`[Suno] Polling error for task ${taskId}:`, error.response?.data || error.message);
    }
  }
  
  return allClips;
}
