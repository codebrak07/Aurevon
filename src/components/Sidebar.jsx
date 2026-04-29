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
      <div className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-glass backdrop-blur-2xl border-r border-glass z-[101] shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header section */}
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-glass relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-1">
                    <img src="/aurevon.png" alt="Aurevon Logo" className="w-10 h-10 rounded-xl border border-glass object-cover shadow-lg" />
                    <h1 className="text-3xl font-black text-primary font-headline tracking-tighter uppercase mb-0">
                        Aurevon
                    </h1>
                </div>
                {userProfile?.name && (
                    <p className="text-secondary font-['Manrope'] text-sm">
                        Hello, <span className="text-primary font-bold">{userProfile.name}</span>
                    </p>
                )}
            </div>
            <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-surface hover:bg-glass flex items-center justify-center text-muted transition-colors relative z-10"
            >
                <span className="material-symbols-outlined text-xl">close</span>
            </button>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
            
            {/* Discovery Section */}
            <div>
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest px-4 mb-4 font-['Manrope']">Discovery</h3>
                <ul className="space-y-2">
                    <li>
                        <button 
                            onClick={() => handleSelect('global-dashboard')}
                            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl bg-surface hover:bg-glass transition-all group text-left border border-glass hover:border-primary/30"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-glow group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-primary text-xl">public</span>
                            </div>
                            <div className="flex-1">
                                <p className="font-['Epilogue'] font-bold text-primary text-lg group-hover:text-primary transition-colors">Global Charts</p>
                                <p className="font-['Manrope'] text-xs text-muted">Gen Z Viral Vibes</p>
                            </div>
                        </button>
                    </li>
                </ul>
            </div>

            {/* Library Section */}
            <div>
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest px-4 mb-4 font-['Manrope']">Your Library</h3>
                <ul className="space-y-2">
                    <li>
                        <button 
                            onClick={() => handleSelect('liked')}
                            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-glass transition-colors group text-left"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30 shadow-glow group-hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                            </div>
                            <div className="flex-1">
                                <p className="font-['Epilogue'] font-bold text-primary text-lg group-hover:text-primary transition-colors">Liked Songs</p>
                                <p className="font-['Manrope'] text-xs text-muted">{likedSongs.length} tracks</p>
                            </div>
                        </button>
                    </li>
                </ul>
            </div>

            {/* Wrapped Section */}
            <div>
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest px-4 mb-4 font-['Manrope']">Your Stats</h3>
                <ul className="space-y-2">
                    <li>
                        <button 
                            onClick={() => handleSelect('wrapped')}
                            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-glass transition-colors group text-left border border-transparent hover:border-glass"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30 shadow-glow group-hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>equalizer</span>
                            </div>
                            <div className="flex-1">
                                <p className="font-['Epilogue'] font-bold text-primary group-hover:text-primary text-lg transition-all">Your Wrapped</p>
                                <p className="font-['Manrope'] text-xs text-muted">Live Listening Stats</p>
                            </div>
                        </button>
                    </li>
                </ul>
            </div>

            {/* Custom Playlists Section */}
            <div>
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest px-4 mb-4 font-['Manrope'] flex justify-between items-center">
                    Collections
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleCreatePlaylist}
                            title="Create Playlist"
                            className="w-6 h-6 rounded-full bg-surface hover:bg-glass flex items-center justify-center text-muted hover:text-primary transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm -mt-[1px]">add</span>
                        </button>
                        <span className="bg-surface text-primary rounded-full px-2 py-0.5 text-[10px]">{playlists.length}</span>
                    </div>
                </h3>
                <ul className="space-y-2">
                    {playlists.map(pl => (
                        <li key={pl.id}>
                            <button 
                                onClick={() => handleSelect(pl.id)}
                                className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-glass transition-colors group text-left"
                            >
                                <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-glass group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
                                    <span className="material-symbols-outlined text-muted text-xl group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>library_music</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-['Epilogue'] font-bold text-primary text-base group-hover:text-primary transition-colors line-clamp-1">{pl.name}</p>
                                    <p className="font-['Manrope'] text-xs text-muted">{pl.tracks?.length || 0} tracks</p>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Admin Section */}
            {['aalekhforapple@gmail.com', 'aalekhmaheshwari@gmail.com', 'ofcaalekhmaheshwari@gmail.com'].includes(userProfile?.email?.toLowerCase()?.trim()) && (
                <div>
                    <h3 className="text-xs font-bold text-primary uppercase tracking-widest px-4 mb-4 font-['Manrope']">Management</h3>
                    <ul className="space-y-2">
                        <li>
                            <button 
                                onClick={() => handleSelect('admin')}
                                className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-all group text-left"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 group-hover:scale-105 transition-transform">
                                    <span className="material-symbols-outlined text-primary text-xl">admin_panel_settings</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-['Epilogue'] font-bold text-primary text-lg group-hover:text-primary transition-colors">Admin Panel</p>
                                    <p className="font-['Manrope'] text-xs text-muted">User Database & Stats</p>
                                </div>
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-glass text-center">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted">Aurevon Player v2.0</p>
        </div>
      </div>
    </>
  );
}
