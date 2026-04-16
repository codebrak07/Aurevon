const BASE_URL = "https://aurevon.onrender.com";

/**
 * Standardized API URL Helper
 * Ensures every request to the backend includes the correct /api prefix and is logged.
 */
export const API = (path) => {
  // Ensure we don't double up on /api
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${BASE_URL}/api${cleanPath}`;
  
  console.log(`🚀 [API Request]: ${url}`);
  return url;
};
