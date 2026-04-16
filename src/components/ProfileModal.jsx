import React, { useRef, useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import usePlayer from '../hooks/usePlayer';
import { searchArtists } from '../services/spotifyService';
import './ProfileModal.css';

export default function ProfileModal({ isOpen, onClose, onOpenSettings, onArtistSelect }) {
  const { 
    userProfile, 
    followedArtists, 
    toggleFollowArtist,
    loginWithGoogle, 
    logout, 
    user, 
    authStatus, 
    isSyncing 
  } = usePlayer();
  
  const [activeView, setActiveView] = useState('main'); // 'main' or 'following'
  const [artistMetadata, setArtistMetadata] = useState({}); // { [artistName]: artistObj }
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && activeView === 'following' && followedArtists.length > 0) {
      const fetchMetadata = async () => {
        setIsLoadingMetadata(true);
        const newMetadata = { ...artistMetadata };
        
        await Promise.all(followedArtists.map(async (name) => {
          if (!newMetadata[name]) {
            try {
              // We search for the artist to get their ID and Image
              const results = await searchArtists(name);
              if (results && results.length > 0) {
                // Find the exact name match or use the first result
                const bestMatch = results.find(a => a.name.toLowerCase() === name.toLowerCase()) || results[0];
                newMetadata[name] = bestMatch;
              }
            } catch (err) {
              console.error(`Failed to fetch metadata for ${name}:`, err);
            }
          }
        }));
        
        setArtistMetadata(newMetadata);
        setIsLoadingMetadata(false);
      };
      fetchMetadata();
    }
  }, [isOpen, activeView, followedArtists]); // eslint-disable-line

  if (!isOpen) return null;

  const displayName = userProfile?.fullName || userProfile?.name || user?.username || 'Guest Listener';
  const displayImage = userProfile?.image || user?.avatarUrl || null;

  const handleOpenSettings = () => {
    onClose();
    onOpenSettings();
  };

  const handleArtistClick = async (artistName) => {
    let meta = artistMetadata[artistName];
    
    if (!meta) {
      // If we don't have the ID, we need to search for the artist first
      const searchResults = await searchArtists(artistName);
      if (searchResults && searchResults.length > 0) {
        meta = searchResults[0];
      }
    }

    if (meta) {
      onArtistSelect(meta);
      onClose(); // Close profile modal when opening artist modal
    }
  };

  return (
    <>
      <div 
        className="profile-modal-overlay" 
        onClick={onClose}
      />
      <div className="profile-modal-container">
        <div className="profile-modal-main">
            {/* Background Glow */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#d394ff]/20 blur-[100px] pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#72fe8f]/10 blur-[100px] pointer-events-none"></div>
            
            <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="profile-modal-close"
                title="Close Profile"
            >
                <span className="material-symbols-outlined text-3xl">close</span>
            </button>

            {activeView === 'main' ? (
                <div className="relative z-10 w-full flex flex-col items-center">
                    {/* Identity Plate */}
                    <div className="profile-modal-identity-avatar relative w-36 h-36 mb-6 mx-auto rounded-full p-1 bg-gradient-to-tr from-[#d394ff] to-[#72fe8f]">
                        <div className="w-full h-full rounded-full bg-[#12121a] p-1">
                            {displayImage ? (
                                <img src={displayImage} alt="Profile" className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-[#d394ff]">
                                    <span className="material-symbols-outlined text-6xl">person</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <h2 className="profile-modal-title text-3xl font-black text-white mb-1 font-['Epilogue'] tracking-tight">{displayName}</h2>
                    <p className="profile-modal-email text-sm text-[#acaab1] mb-10 font-['Manrope'] font-medium opacity-60">{user?.email || 'Guest Mode'}</p>

                    {/* Stats Interaction */}
                    <div className="profile-modal-stats flex gap-16 mb-12 w-full justify-center">
                        <div className="flex flex-col items-center cursor-not-allowed opacity-50">
                            <span className="text-3xl font-black text-white leading-none">0</span>
                            <span className="text-[10px] text-[#acaab1] uppercase tracking-[0.3em] font-black mt-3">Followers</span>
                        </div>
                        <div className="w-px h-12 bg-white/10 self-center" />
                        <button 
                            className="flex flex-col items-center group transition-transform hover:scale-110"
                            onClick={() => setActiveView('following')}
                        >
                            <span className="text-3xl font-black text-[#d394ff] group-hover:text-white transition-colors leading-none">
                                {followedArtists?.length || 0}
                            </span>
                            <span className="text-[10px] text-[#acaab1] group-hover:text-[#d394ff] uppercase tracking-[0.3em] font-black mt-3 transition-colors">
                                Following
                            </span>
                        </button>
                    </div>

                    <div className="profile-modal-actions w-full space-y-4 mb-10">
                        <button 
                            onClick={handleOpenSettings}
                            className="profile-modal-action-btn w-full py-5 rounded-[1.25rem] font-black tracking-widest uppercase text-[10px] bg-white/5 hover:bg-white text-white hover:text-black transition-all flex items-center justify-center gap-3 border border-white/10"
                        >
                            <span className="material-symbols-outlined text-xl">tune</span>
                            Account Settings
                        </button>
                        
                        {authStatus === 'authenticated' ? (
                            <div className="bg-white/5 rounded-[1.25rem] p-6 border border-white/10 w-full backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 text-[#72fe8f]">
                                        <span className="material-symbols-outlined text-sm">verified</span>
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Logged In</span>
                                    </div>
                                    <button onClick={logout} className="text-[9px] text-red-400 font-black uppercase tracking-widest">Sign Out</button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#72fe8f] shadow-[0_0_10px_#72fe8f]"></div>
                                    <span className="text-[10px] text-[#acaab1] font-bold uppercase tracking-tighter">Your data is synced</span>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-6 flex flex-col items-center gap-6">
                                <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                <GoogleLogin 
                                    onSuccess={(res) => loginWithGoogle(res.credential)}
                                    onError={() => console.error('Login Failed')}
                                    theme="filled_black"
                                    shape="circle"
                                />
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={onClose}
                        className="text-[10px] text-[#acaab1] hover:text-white uppercase font-black tracking-[0.4em] transition-all"
                    >
                        Close
                    </button>
                </div>
            ) : (
                <div className="relative z-10 w-full flex flex-col h-full">
                    {/* Sub View: Following List */}
                    <header className="flex items-center mb-8">
                        <button 
                            onClick={() => setActiveView('main')}
                            className="p-2 -ml-2 rounded-full hover:bg-white/5 text-[#acaab1] hover:text-white transition-all focus:outline-none"
                        >
                            <span className="material-symbols-outlined text-2xl">arrow_back</span>
                        </button>
                        <h3 className="ml-4 text-xl font-bold text-white uppercase tracking-[0.1em]">Artists Following</h3>
                    </header>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {followedArtists.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-[#acaab1] opacity-50">
                                <span className="material-symbols-outlined text-5xl mb-4">group</span>
                                <p className="text-sm font-bold uppercase tracking-widest">Choose some favorites!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {followedArtists.map((artistName) => {
                                  const metadata = artistMetadata[artistName];
                                  return (
                                    <div 
                                        key={artistName}
                                        onClick={() => handleArtistClick(artistName)}
                                        className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
                                                {metadata?.image ? (
                                                  <img 
                                                    src={metadata.image} 
                                                    alt={artistName} 
                                                    className="w-full h-full object-cover" 
                                                    loading="lazy" 
                                                  />
                                                ) : (
                                                  <div className="w-full h-full flex items-center justify-center text-[#d394ff] animate-pulse">
                                                    <span className="material-symbols-outlined">artist</span>
                                                  </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="font-bold text-white text-sm group-hover:text-[#d394ff] transition-colors">{artistName}</span>
                                              <span className="text-[10px] text-[#acaab1] uppercase tracking-widest font-bold">
                                                {metadata?.genre || 'Artist'}
                                              </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFollowArtist(artistName);
                                            }}
                                            className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-all border border-white/5"
                                        >
                                          Unfollow
                                        </button>
                                    </div>
                                  );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-[9px] text-[#acaab1] uppercase tracking-widest font-bold opacity-40">
                            Discover more from your {followedArtists.length} favorites
                        </p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </>
  );
}
