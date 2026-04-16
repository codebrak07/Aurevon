import React from 'react';
import usePlayer from '../hooks/usePlayer';

export default function AddToPlaylistModal({ isOpen, onClose, track, onOpenCreatePlaylist }) {
  const { playlists, addToPlaylist } = usePlayer();

  if (!isOpen || !track) return null;

  const handleSelect = (playlistId) => {
    addToPlaylist(playlistId, track);
    onClose();
  };

  const handleCreateNew = () => {
    onOpenCreatePlaylist(track);
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] animate-[fadeIn_0.2s_ease-out]" 
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-[201] p-4 animate-[slideUp_0.4s_ease-out]">
        <div className="bg-[#12121a] border border-white/10 rounded-t-[2rem] rounded-b-xl p-6 shadow-2xl max-w-lg mx-auto overflow-hidden relative">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full mb-6"></div>
            
            <header className="flex justify-between items-center mb-6 mt-4">
                <div>
                    <h2 className="text-xl font-bold font-['Epilogue'] text-white">Add to Playlist</h2>
                    <p className="text-[#acaab1] text-xs font-['Manrope'] truncate max-w-[200px]">"{track.title}"</p>
                </div>
                <button 
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#d394ff]/10 text-[#d394ff] hover:bg-[#d394ff]/20 transition-all text-sm font-bold"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    New
                </button>
            </header>

            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {playlists.length === 0 ? (
                    <div className="py-12 text-center">
                        <span className="material-symbols-outlined text-4xl text-[#acaab1] opacity-20 mb-2">library_music</span>
                        <p className="text-[#acaab1] text-sm">No collections yet.</p>
                    </div>
                ) : (
                    playlists.map(pl => (
                        <button 
                            key={pl.id}
                            onClick={() => handleSelect(pl.id)}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all group text-left border border-transparent hover:border-white/5"
                        >
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-[#72fe8f]/10 group-hover:border-[#72fe8f]/20 transition-all shadow-inner">
                                <span className="material-symbols-outlined text-xl text-[#acaab1] group-hover:text-[#72fe8f] transition-colors">library_music</span>
                            </div>
                            <div className="flex-1">
                                <p className="font-['Manrope'] font-bold text-white group-hover:text-[#72fe8f] transition-colors">{pl.name}</p>
                                <p className="text-[#686880] text-xs uppercase tracking-widest">{pl.tracks?.length || 0} tracks</p>
                            </div>
                            <span className="material-symbols-outlined text-[#acaab1] opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                        </button>
                    ))
                )}
            </div>

            <button 
                onClick={onClose}
                className="w-full mt-6 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] text-[#acaab1] hover:text-white hover:bg-white/5 transition-all"
            >
                Cancel
            </button>
        </div>
      </div>
    </>
  );
}
