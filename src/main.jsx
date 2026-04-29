import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('App update available');
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  },
});

console.log('--- AUREVON BOOTING ---');

const rootId = document.getElementById('root');

if (!rootId) {
  document.body.innerHTML = '<div style="color:white;padding:50px;"><h1>CRITICAL ERROR</h1><p>Root element #root not found in index.html</p></div>';
} else {
  try {
    const root = createRoot(rootId);
    root.render(<App />);
    console.log('--- AUREVON MOUNTED ---');
  } catch (err) {
    console.error('--- MOUNT FAILED ---', err);
    rootId.innerHTML = `<div style="color:white;padding:50px;"><h1>APP CRASH</h1><pre>${err.message}</pre></div>`;
  }
}
