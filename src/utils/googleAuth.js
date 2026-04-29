export function getGoogleOriginIssue() {
  if (typeof window === 'undefined') return null;

  const { origin, hostname } = window.location;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return 'Missing VITE_GOOGLE_CLIENT_ID.';
  }

  if (hostname === '127.0.0.1') {
    return `Google Sign-In is running on ${origin}, but this client is usually authorized for localhost instead. Open the app on http://localhost:5173 or add ${origin} to Authorized JavaScript origins in Google Cloud Console.`;
  }

  return null;
}
