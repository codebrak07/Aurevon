import React from 'react';
import usePlayer from '../hooks/usePlayer';

export default function Sidebar({ isOpen, onClose, onSelectTab, onOpenCreatePlaylist }) {
  const { playlists, likedSongs, userProfile } = usePlayer();

  const handleSelect = (id) => {
    onSelectTab(id);
    onClose();
  };

  const handleCreatePlaylist = () => {
    onOpenCreatePlaylist();
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-[#0c0c12]/95 backdrop-blur-2xl border-r border-white/5 z-[101] shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header section */}
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#d394ff]/10 to-transparent opacity-50"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-1">
                    <img src="/aurevon.png" alt="Aurevon Logo" className="w-10 h-10 rounded-xl border border-white/10 object-cover shadow-lg" />
                    <h1 className="text-3xl font-black text-white font-headline tracking-tighter uppercase mb-0">
                        Aurevon
                    </h1>
                </div>
                {userProfile?.name && (
                    <p className="text-[#acaab1] font-['Manrope'] text-sm">
                        Hello, <span className="text-[#d394ff] font-bold">{userProfile.name}</span>
                    </p>
                )}
            </div>
            <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#acaab1] transition-colors relative z-10"
            >
                <span className="material-symbols-outlined text-xl">close</span>
            </button>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
            
            {/* Library Section */}
            <div>
                <h3 className="text-xs font-bold text-[#686880] uppercase tracking-widest px-4 mb-4 font-['Manrope']">Your Library</h3>
                <ul className="space-y-2">
                    <li>
                        <button 
                            onClick={() => handleSelect('liked')}
                            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/5 transition-colors group text-left"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d394ff]/20 to-[#aa30fa]/20 flex items-center justify-center border border-[#d394ff]/30 shadow-[0_0_15px_rgba(211,148,255,0.15)] group-hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-[#d394ff] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                            </div>
                            <div className="flex-1">
                                <p className="font-['Epilogue'] font-bold text-white text-lg group-hover:text-[#d394ff] transition-colors">Liked Songs</p>
                                <p className="font-['Manrope'] text-xs text-[#acaab1]">{likedSongs.length} tracks</p>
                            </div>
                        </button>
                    </li>
                </ul>
            </div>

            {/* Custom Playlists Section */}
            <div>
                <h3 className="text-xs font-bold text-[#686880] uppercase tracking-widest px-4 mb-4 font-['Manrope'] flex justify-between items-center">
                    Collections
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleCreatePlaylist}
                            title="Create Playlist"
                            className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-[#acaab1] hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm -mt-[1px]">add</span>
                        </button>
                        <span className="bg-white/10 text-white rounded-full px-2 py-0.5 text-[10px]">{playlists.length}</span>
                    </div>
                </h3>
                <ul className="space-y-2">
                    {playlists.map(pl => (
                        <li key={pl.id}>
                            <button 
                                onClick={() => handleSelect(pl.id)}
                                className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/5 transition-colors group text-left"
                            >
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-[#72fe8f]/10 group-hover:border-[#72fe8f]/30 transition-all">
                                    <span className="material-symbols-outlined text-[#acaab1] text-xl group-hover:text-[#72fe8f] transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>library_music</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-['Epilogue'] font-bold text-white/90 text-base group-hover:text-[#72fe8f] transition-colors line-clamp-1">{pl.name}</p>
                                    <p className="font-['Manrope'] text-xs text-[#acaab1]">{pl.tracks?.length || 0} tracks</p>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 text-center">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#686880]">Aurevon Player v2.0</p>
        </div>
      </div>
    </>
  );
}
