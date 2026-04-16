import React, { useState, useEffect, useRef } from 'react';
import usePlayer from '../hooks/usePlayer';

export default function CreatePlaylistModal({ isOpen, onClose, onCreated, initialTrack }) {
  const { createPlaylist, addToPlaylist } = usePlayer();
  const [playlistName, setPlaylistName] = useState('');
  const inputRef = useRef(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setPlaylistName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = playlistName.trim();
    if (trimmedName) {
      const newPlaylist = createPlaylist(trimmedName);
      
      // If we have an initial track, add it to the new playlist
      if (initialTrack && newPlaylist) {
        addToPlaylist(newPlaylist.id, initialTrack);
      }
      
      if (onCreated) onCreated(newPlaylist);
      onClose();
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] animate-[fadeIn_0.2s_ease-out]" 
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-[301] p-4 animate-[slideUp_0.4s_ease-out]">
        <div className="bg-[#12121a]/95 backdrop-blur-2xl border border-white/10 rounded-t-[2.5rem] rounded-b-xl p-8 shadow-2xl max-w-lg mx-auto relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#d394ff]/10 blur-[80px] rounded-full"></div>
            
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full"></div>
            
            <header className="mb-8 pt-4">
                <h2 className="text-2xl font-black font-['Epilogue'] text-white tracking-tight">New Collection</h2>
                <p className="text-[#686880] text-sm font-['Manrope'] mt-1">Name your sonic space.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="relative group">
                    <input
                        ref={inputRef}
                        type="text"
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder="e.g. Late Night Vibes"
                        className="w-full bg-white/5 border-b-2 border-white/10 py-4 px-0 text-xl text-white placeholder:text-white/10 focus:outline-none focus:border-[#d394ff] transition-all font-bold"
                    />
                    <div className="absolute bottom-0 left-0 h-0.5 bg-[#d394ff] w-0 group-focus-within:w-full transition-all duration-500 shadow-[0_0_10px_rgba(211,148,255,0.5)]"></div>
                </div>

                <div className="flex gap-4">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] text-[#acaab1] hover:text-white hover:bg-white/5 transition-all border border-white/5"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        disabled={!playlistName.trim()}
                        className={`flex-[1.5] py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all ${
                            playlistName.trim() 
                            ? 'bg-[#d394ff] text-black shadow-[0_0_30px_rgba(211,148,255,0.3)] hover:scale-[1.02] active:scale-95' 
                            : 'bg-white/5 text-[#acaab1] opacity-50 cursor-not-allowed'
                        }`}
                    >
                        Create
                        <span className="material-symbols-outlined text-sm">rocket_launch</span>
                    </button>
                </div>
            </form>
        </div>
      </div>
    </>
  );
}
