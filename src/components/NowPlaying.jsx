import { useState, memo, useRef, useCallback } from 'react';
import usePlayer from '../hooks/usePlayer';
import { formatTime } from '../utils/mappers';
import LyricsViewer from './LyricsViewer';
import './NowPlaying.css'; // kept for fallback

const NowPlaying = memo(function NowPlaying({ isOpen, onClose, onAddToPlaylist }) {
  const { 
    currentTrack, toggleLike, isLiked,
    isPlaying, togglePlay, nextTrack, prevTrack, shuffleEnabled, toggleShuffle, loopEnabled, toggleLoop, isLoading,
    currentTime, duration, seekTo,
    volume, setVolume
  } = usePlayer();
  
  const [viewMode, setViewMode] = useState('artwork'); 

  // Player Scrubber Logic
  const barRef = useRef(null);
  const isDragging = useRef(false);

  // Volume Scrubber Logic
  const volRef = useRef(null);

  const getTimeFromEvent = useCallback((e) => {
    if (!barRef.current || !duration) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  }, [duration]);

  const handlePointerDown = useCallback((e) => {
    isDragging.current = true;
    const time = getTimeFromEvent(e);
    seekTo(time);

    const handleMove = (ev) => {
      if (isDragging.current) {
        seekTo(getTimeFromEvent(ev));
      }
    };
    const handleUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: true });
    document.addEventListener('touchend', handleUp);
  }, [getTimeFromEvent, seekTo]);

  const getVolFromEvent = useCallback((e) => {
    if (!volRef.current) return 0;
    const rect = volRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 100);
  }, []);

  const handleVolDown = useCallback((e) => {
    const vol = getVolFromEvent(e);
    setVolume(vol);
    const handleMove = (ev) => setVolume(getVolFromEvent(ev));
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: true });
    document.addEventListener('touchend', handleUp);
  }, [getVolFromEvent, setVolume]);

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <div 
        className={`fixed inset-0 z-[500] transition-all duration-500 ease-in-out ${isOpen ? 'opacity-100 pointer-events-auto shadow-2xl' : 'opacity-0 pointer-events-none'}`}
      >
        <div 
          className="absolute inset-0 bg-background/90 backdrop-blur-3xl z-[-1]" 
          onClick={onClose} 
        />
        
        <div className={`np-container absolute top-0 left-0 w-full h-full bg-surface text-on-surface font-body overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] transform ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          {/* Ambient Background Halo */}
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {currentTrack.albumArt && (
              <div 
                className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[140%] h-[140%] blur-[120px] rounded-full opacity-30 mix-blend-screen transition-all duration-1000" 
                style={{ backgroundImage: `url(${currentTrack.albumArt})`, backgroundSize: 'cover' }}
              />
            )}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[140%] h-[140%] bg-primary-container/15 blur-[140px] rounded-full transition-all duration-1000" />
            <div className="absolute inset-0 bg-background/80 mix-blend-overlay" />
          </div>

          {/* Main Content Layer */}
          <main className="np-main relative z-10 flex flex-col max-w-lg mx-auto w-full">
            {/* TopAppBar */}
            <header className="flex justify-between items-center w-full px-6 py-3 bg-transparent flex-shrink-0">
              <button onClick={onClose} className="hover:opacity-80 transition-opacity active:scale-95 duration-200">
                <span className="material-symbols-outlined text-[#72fe8f] text-[28px] drop-shadow-lg">expand_more</span>
              </button>
              
              <div className="flex items-center gap-4">
                 <button 
                   onClick={() => onAddToPlaylist && onAddToPlaylist(currentTrack)} 
                   className="hover:opacity-80 transition-opacity active:scale-95 duration-200"
                   aria-label="Add to playlist"
                 >
                    <span className="material-symbols-outlined text-on-surface-variant text-[26px] drop-shadow-lg">playlist_add</span>
                 </button>
                 <button onClick={() => setViewMode(viewMode === 'artwork' ? 'lyrics' : 'artwork')} className="hover:opacity-80 transition-opacity active:scale-95 duration-200">
                    <span className={`material-symbols-outlined text-[26px] drop-shadow-lg ${viewMode === 'lyrics' ? 'text-[#72fe8f]' : 'text-on-surface-variant'}`}>{viewMode === 'lyrics' ? 'lyrics' : 'queue_music'}</span>
                 </button>
              </div>
            </header>

            {viewMode === 'lyrics' ? (
              <div className="flex-1 overflow-auto relative z-20 px-6 py-4 custom-scrollbar min-h-0">
                 <LyricsViewer />
              </div>
            ) : (
              <>
                {/* Album Art — fills all remaining space */}
                <section className="flex-1 flex items-center justify-center px-6 min-h-0 np-artwork-section">
                  <div className="relative group aspect-square w-full max-w-[400px] flex items-center justify-center" style={{ maxHeight: '100%' }}>
                    <div className="absolute inset-2 bg-primary-container/40 blur-[40px] rounded-[3rem] -z-10 group-hover:bg-primary-container/60 transition-all duration-700 ease-in-out"></div>
                    {currentTrack.albumArt ? (
                      <img 
                        alt={currentTrack.album} 
                        className="w-full h-full object-cover rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-[1.02]" 
                        src={currentTrack.albumArt}
                      />
                    ) : (
                      <div className="w-full h-full rounded-[2.5rem] bg-surface-container flex items-center justify-center shadow-2xl border border-white/5">
                        <span className="material-symbols-outlined text-7xl text-on-surface-variant opacity-50">album</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Bottom Controls — pinned at bottom */}
                <div className="flex-shrink-0 np-bottom-group">
                  <section className="px-6 pt-3 pb-1 flex items-center justify-between np-track-info">
                    <div className="flex flex-col overflow-hidden mr-6">
                      <h1 className="text-2xl font-[800] tracking-tight leading-tight mb-1 truncate text-white drop-shadow-sm np-title">{currentTrack.title}</h1>
                      <p className="text-on-surface-variant text-base font-medium tracking-wide truncate np-artist">{currentTrack.artist}</p>
                    </div>
                    <button onClick={() => toggleLike(currentTrack)} className={`hover:scale-110 active:scale-90 transition-transform ${liked ? 'text-[#1DB954]' : 'text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined text-3xl drop-shadow-md" style={{ fontVariationSettings: liked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                    </button>
                  </section>

                  <section className="px-6 mt-3 mb-2 np-scrubber">
                    <div 
                      className="relative w-full h-[6px] bg-surface-container-highest rounded-full group cursor-pointer overflow-visible"
                      ref={barRef}
                      onMouseDown={handlePointerDown}
                      onTouchStart={handlePointerDown}
                    >
                      <div 
                        className="absolute left-0 top-0 h-full bg-[#1DB954] rounded-full group-hover:bg-[#1ed760] transition-colors relative" 
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity transform"></div>
                      </div>
                    </div>
                    <div className="flex justify-between mt-3">
                      <span className="text-[11px] font-[600] text-on-surface-variant tracking-wider">{formatTime(currentTime)}</span>
                      <span className="text-[11px] font-[600] text-on-surface-variant tracking-wider">{formatTime(duration)}</span>
                    </div>
                  </section>

                  <section className="px-8 mt-2 flex items-center justify-between mb-3 np-controls">
                    <button onClick={toggleShuffle} className={`${shuffleEnabled ? 'text-[#1DB954]' : 'text-on-surface-variant'} hover:text-white transition-colors active:scale-95`}>
                      <span className="material-symbols-outlined text-[28px]">shuffle</span>
                    </button>
                    <div className="flex items-center gap-6">
                      <button onClick={prevTrack} className="text-on-surface hover:text-[#1DB954] transition-colors active:scale-90">
                        <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>skip_previous</span>
                      </button>
                      <button onClick={togglePlay} disabled={isLoading} className="bg-[#1DB954] hover:bg-[#1ed760] text-black w-[64px] h-[64px] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(29,185,84,0.4)] active:scale-95 transition-all np-play-btn">
                        {isLoading ? (
                          <span className="material-symbols-outlined text-[36px] animate-spin">sync</span>
                        ) : (
                          <span className="material-symbols-outlined text-[44px]" style={{ fontVariationSettings: "'FILL' 1" }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
                        )}
                      </button>
                      <button onClick={nextTrack} className="text-on-surface hover:text-[#1DB954] transition-colors active:scale-90">
                        <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>skip_next</span>
                      </button>
                    </div>
                    <button onClick={toggleLoop} className={`${loopEnabled ? 'text-[#1DB954]' : 'text-on-surface-variant'} hover:text-white transition-colors active:scale-95`}>
                      <span className="material-symbols-outlined text-[28px]">repeat</span>
                    </button>
                  </section>

                  <footer className="px-8 pb-8 flex items-center justify-between np-footer">
                    <button className="text-on-surface-variant hover:text-white transition-colors active:scale-95">
                      <span className="material-symbols-outlined cursor-pointer text-[22px]">devices</span>
                    </button>
                    <div className="flex-grow mx-6 flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]" onClick={() => setVolume(0)}>volume_down</span>
                      <div 
                        className="flex-grow h-[4px] bg-surface-container-highest rounded-full overflow-visible relative cursor-pointer group"
                        ref={volRef}
                        onMouseDown={handleVolDown}
                        onTouchStart={handleVolDown}
                      >
                        <div className="h-full bg-on-surface-variant group-hover:bg-[#1DB954] transition-colors rounded-full absolute top-0 left-0" style={{ width: `${volume}%` }}>
                          <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-[12px] h-[12px] bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]" onClick={() => setVolume(100)}>volume_up</span>
                    </div>
                    <button className="text-on-surface-variant hover:text-white transition-colors active:scale-95">
                      <span className="material-symbols-outlined cursor-pointer text-[22px]">share</span>
                    </button>
                  </footer>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
});

export default NowPlaying;
