import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ShareButton({ type, payload, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleShare = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      let url = window.location.href; // Fallback
      if (type === 'song') {
        url = `${window.location.origin}/listen?song=${payload.id || payload}`;
      } else if (type === 'playlist') {
        url = `${window.location.origin}/playlist?id=${payload.id || payload}`;
      } else if (type === 'artist') {
        url = `${window.location.origin}/artist?id=${payload.id || payload}`;
      } else if (type === 'album') {
        url = `${window.location.origin}/album?id=${payload.id || payload}`;
      }

      // Use native share if on mobile, else fallback to clipboard
      if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
        await navigator.share({
          title: 'Aurevon',
          text: `Check this out on Aurevon:`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to share', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button 
        onClick={handleShare}
        disabled={loading}
        className={`flex items-center justify-center hover:scale-110 active:scale-95 transition-transform ${className}`}
        title="Share"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 'inherit' }}>
          {loading ? 'hourglass_empty' : 'ios_share'}
        </span>
      </button>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-[#d394ff] text-black text-xs font-bold rounded-full whitespace-nowrap shadow-lg pointer-events-none z-50 font-['Manrope']"
          >
            Copied link!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
