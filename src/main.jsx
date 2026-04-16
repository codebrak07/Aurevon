import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || atob('NjAwNzYwNzM5MTA5LWhzb2FrYXJqa3N2bjdjMTE2ZHJkZWhoZzVpajhkZTlvLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
