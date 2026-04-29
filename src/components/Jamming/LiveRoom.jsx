import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useJam } from '../../context/JamContext';
import usePlayer from '../../hooks/usePlayer';
import SearchBar from '../SearchBar';

export default function LiveRoom() {
  const { currentRoom, isHost, participants, leaveRoom, castVote, sendHostCommand } = useJam();
  const { currentTrack, isPlaying, playTrack, playerRef } = usePlayer();

  const roomTrack = currentRoom?.queue?.[currentRoom?.currentTrackIndex ?? 0] || null;

  const activeParticipants = useMemo(() => {
    return participants.filter(p => {
      const diff = Date.now() - new Date(p.lastSeen).getTime();
      return diff < 90000;
    });
  }, [participants]);

  const threshold = useMemo(() => {
    const total = activeParticipants.length || 1;
    return total > 2 ? Math.floor(total / 2) + 1 : 1;
  }, [activeParticipants.length]);

  const progressPercentage = Math.min((currentRoom?.voteCount || 0) / threshold * 100, 100);

  useEffect(() => {
    if (!roomTrack) return;

    if (currentTrack?.id !== roomTrack.id) {
      playTrack(roomTrack);
      return;
    }

    if (!playerRef.current) return;

    try {
      if (currentRoom?.state === 'paused' && isPlaying) {
        playerRef.current.pauseVideo();
      }

      if (currentRoom?.state === 'playing' && !isPlaying) {
        playerRef.current.playVideo();
      }
    } catch {
      // Ignore transient player state errors while the iframe is loading.
    }
  }, [currentRoom?.state, currentTrack?.id, isPlaying, playTrack, playerRef, roomTrack]);

  const handleAddToQueue = async (track) => {
    try {
      await sendHostCommand('queue', { song: track });
    } catch (err) {
      console.error('Failed to add to queue', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="live-room-header rounded-2xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-['Manrope']">Room Code</span>
            <span className="text-3xl font-black text-[var(--text-primary)] font-['Epilogue'] tracking-widest">{currentRoom?.roomCode}</span>
          </div>
          <div className="h-10 w-[1px] bg-[var(--glass-border)] hidden md:block"></div>
          <div className="flex -space-x-3">
            {activeParticipants.slice(0, 5).map((p) => {
              const isPulsing = Date.now() - new Date(p.lastSeen).getTime() < 10000;
              const isRoomHost = p.uid === currentRoom?.hostId;
              
              return (
                <div key={p.uid} className={`participant-avatar ${isRoomHost ? 'host z-10' : 'z-0'}`} title={`${p.name} ${isRoomHost ? '(Host)' : ''}`}>
                  {isPulsing && <div className="participant-pulse"></div>}
                  {p.name.charAt(0).toUpperCase()}
                  {isRoomHost && (
                    <div className="absolute -top-2 -right-2 bg-[var(--accent-purple)] text-black rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                      <span className="material-symbols-outlined text-[12px]">star</span>
                    </div>
                  )}
                </div>
              );
            })}
            {activeParticipants.length > 5 && (
              <div className="participant-avatar bg-[var(--surface-container-high)] text-[var(--text-secondary)] text-xs z-0">
                +{activeParticipants.length - 5}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {isHost && (
             <div className="bg-[var(--accent-green)]/10 text-[var(--accent-green)] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-[var(--accent-green)]/30 flex items-center gap-1">
               <span className="material-symbols-outlined text-sm">verified_user</span>
               You are Host
             </div>
           )}
           <button onClick={leaveRoom} className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors border border-red-500/20">
             <span className="material-symbols-outlined">logout</span>
           </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Player Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--bg-glass-heavy)] border border-[var(--glass-border)] rounded-3xl p-6 md:p-10 backdrop-blur-xl relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-purple)]/5 to-transparent opacity-50"></div>
             
             <div className="relative z-10 text-center flex flex-col items-center">
                {currentTrack ? (
                  <>
                    <img src={currentTrack.albumArt} alt="Artwork" className="w-64 h-64 rounded-2xl shadow-2xl mb-6 object-cover" />
                    <h2 className="text-3xl font-bold text-[var(--text-primary)] font-['Epilogue'] mb-2">{currentTrack.title}</h2>
                    <p className="text-[var(--text-secondary)] text-lg font-['Manrope'] mb-8">{currentTrack.artist}</p>
                    
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={castVote}
                        className="flex items-center gap-3 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] border border-[var(--glass-border)] px-6 py-3 rounded-full transition-all group-hover:border-[var(--accent-purple)]/30"
                      >
                        <div className="relative w-8 h-8 flex items-center justify-center">
                          <svg className="circular-progress absolute inset-0 w-full h-full" viewBox="0 0 36 36">
                            <path className="circular-progress-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path className="circular-progress-value" strokeDasharray={`${progressPercentage}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          </svg>
                          <span className="material-symbols-outlined text-[var(--accent-purple)] text-sm relative z-10">skip_next</span>
                        </div>
                        <div className="flex flex-col items-start">
                           <span className="text-[var(--text-primary)] font-bold text-sm">Vote Skip</span>
                           <span className="text-[var(--text-muted)] text-xs">{currentRoom?.voteCount || 0} / {threshold} votes</span>
                        </div>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-20 flex flex-col items-center">
                    <span className="material-symbols-outlined text-6xl text-[var(--text-muted)] opacity-20 mb-4">music_off</span>
                    <p className="text-[var(--text-secondary)] font-['Manrope']">Queue is empty. Add a song to start jamming.</p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Sidebar / Queue */}
        <div className="space-y-6">
          <div className="bg-[var(--bg-glass-heavy)] border border-[var(--glass-border)] rounded-2xl p-6 backdrop-blur-xl">
             <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 font-['Manrope']">Add to Queue</h3>
             <SearchBar 
                onAddToPlaylist={handleAddToQueue} 
                compact={true}
             />
          </div>

          <div className="bg-[var(--bg-glass-heavy)] border border-[var(--glass-border)] rounded-2xl p-6 backdrop-blur-xl h-[400px] flex flex-col">
             <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 font-['Manrope'] flex justify-between">
               Up Next
               <span className="text-[var(--text-secondary)]">{currentRoom?.queue?.length - (currentRoom?.currentTrackIndex + 1) || 0} tracks</span>
             </h3>
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
               {currentRoom?.queue?.slice(currentRoom.currentTrackIndex + 1).map((track, i) => (
                 <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-container-high)] transition-colors group">
                    <img src={track.albumArt} alt="" className="w-10 h-10 rounded-md object-cover" />
                    <div className="flex-1 overflow-hidden">
                       <p className="text-sm font-bold text-[var(--text-primary)] truncate">{track.title}</p>
                       <p className="text-xs text-[var(--text-secondary)] truncate">{track.artist}</p>
                    </div>
                 </div>
               ))}
               {(!currentRoom?.queue || currentRoom.queue.length <= currentRoom.currentTrackIndex + 1) && (
                 <p className="text-center text-[var(--text-muted)] text-sm mt-10">Queue is empty</p>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
