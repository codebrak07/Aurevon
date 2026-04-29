import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJam } from '../../context/JamContext';
import usePlayer from '../../hooks/usePlayer';
import SearchBar from '../SearchBar';

export default function LiveRoom() {
  const {
    currentRoom,
    roomCode: contextRoomCode,
    isHost,
    participants,
    leaveRoom,
    castVote,
    addToQueue,
    refreshRoom,
    playPause,
    skipTrack,
    removeFromQueue,
  } = useJam();

  const { playTrack, playerRef, isPlaying, currentTrack } = usePlayer();
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(null);
  const [queueError, setQueueError] = useState(null);
  const [addingToQueue, setAddingToQueue] = useState(false);

  // Track what room track we've already triggered playback for
  const lastPlayedRoomTrackRef = useRef(null);

  // Use contextRoomCode (set synchronously during create/join) as primary,
  // fall back to currentRoom?.roomCode (set async via snapshot)
  const displayRoomCode = contextRoomCode || currentRoom?.roomCode || null;

  // ── Room track is the authoritative source of truth ──
  const roomTrack = currentRoom?.queue?.[currentRoom?.currentTrackIndex ?? 0] || null;
  const roomState = currentRoom?.state || 'waiting';

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

  // ── Sync room track to the actual player ──
  // When the room's current track changes, play it on the local player.
  // When room state changes (play/pause), sync the local player accordingly.
  useEffect(() => {
    if (!roomTrack) return;

    const roomTrackId = roomTrack.id || roomTrack.title; // fallback key

    // If the room track changed, play the new track
    if (lastPlayedRoomTrackRef.current !== roomTrackId) {
      lastPlayedRoomTrackRef.current = roomTrackId;
      playTrack(roomTrack);
      return;
    }

    // Sync play/pause state from room
    if (!playerRef.current) return;

    try {
      if (roomState === 'paused' && isPlaying) {
        playerRef.current.pauseVideo();
      }

      if (roomState === 'playing' && !isPlaying) {
        playerRef.current.playVideo();
      }
    } catch {
      // Ignore transient player state errors while the iframe is loading.
    }
  }, [roomState, roomTrack, isPlaying, playTrack, playerRef]);

  // ── Handle adding a song to the shared queue (works for host AND guest) ──
  const handleAddToQueue = useCallback(async (track) => {
    if (addingToQueue) return; // prevent double-tap on mobile
    setAddingToQueue(true);
    setQueueError(null);
    try {
      await addToQueue(track);
      setAddedFeedback(track.title);
      setTimeout(() => setAddedFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to add to queue:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to add song';
      setQueueError(msg);
      setTimeout(() => setQueueError(null), 4000);
    } finally {
      setAddingToQueue(false);
    }
  }, [addToQueue, addingToQueue]);

  // ── Copy room code ──
  const handleCopyCode = useCallback(async () => {
    if (!displayRoomCode) return;
    try {
      await navigator.clipboard.writeText(displayRoomCode);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback for older browsers / insecure contexts
      const textarea = document.createElement('textarea');
      textarea.value = displayRoomCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  }, [displayRoomCode]);

  // ── Queue items after current track ──
  const upcomingQueue = useMemo(() => {
    const q = currentRoom?.queue || [];
    const idx = currentRoom?.currentTrackIndex ?? 0;
    return q.slice(idx + 1).map((track, i) => ({ ...track, _queueIndex: idx + 1 + i }));
  }, [currentRoom?.queue, currentRoom?.currentTrackIndex]);

  // ── Watch queue changes to show notification when someone else adds a song ──
  const prevQueueLengthRef = useRef(currentRoom?.queue?.length || 0);
  useEffect(() => {
    const currentLen = currentRoom?.queue?.length || 0;
    const prevLen = prevQueueLengthRef.current;
    if (currentLen > prevLen && prevLen > 0) {
      // A new song was added (not the initial load)
      const newSong = currentRoom.queue[currentLen - 1];
      if (newSong) {
        setAddedFeedback(`"${newSong.title}" added to queue`);
        setTimeout(() => setAddedFeedback(null), 3000);
      }
    }
    prevQueueLengthRef.current = currentLen;
  }, [currentRoom?.queue?.length]);

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="live-room-header rounded-2xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          {/* ── ROOM CODE BADGE ── */}
          <div 
            className="room-code-badge"
            onClick={handleCopyCode}
            title={displayRoomCode ? `Click to copy: ${displayRoomCode}` : 'Generating room code...'}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleCopyCode()}
          >
            <span className="room-code-label">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
              {copyFeedback ? 'Copied!' : 'Room Code — Tap to Copy'}
            </span>
            {displayRoomCode ? (
              <span className="room-code-value">
                {displayRoomCode.split('').map((char, i) => (
                  <span key={i} className="room-code-char">{char}</span>
                ))}
              </span>
            ) : (
              <span className="room-code-value room-code-loading">
                {[...Array(6)].map((_, i) => (
                  <span key={i} className="room-code-char room-code-skeleton">•</span>
                ))}
              </span>
            )}

            {/* Copy feedback overlay */}
            <AnimatePresence>
              {copyFeedback && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="room-code-copied-toast"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                  Copied to clipboard!
                </motion.div>
              )}
            </AnimatePresence>
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
           {!isHost && (
             <div className="bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-[var(--accent-purple)]/30 flex items-center gap-1">
               <span className="material-symbols-outlined text-sm">headphones</span>
               Listener
             </div>
           )}
           <button onClick={leaveRoom} className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors border border-red-500/20">
             <span className="material-symbols-outlined">logout</span>
           </button>
        </div>
      </div>

      {currentRoom?.isLocalFallback && (
        <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 p-4 rounded-xl mb-8 text-center font-['Manrope'] text-sm shadow-md">
          <span className="font-bold flex items-center justify-center gap-2 mb-1">
            <span className="material-symbols-outlined text-lg">warning</span>
            Server Connection Failed
          </span>
          You are currently in a local, offline room because the backend server is unreachable. Other users will not be able to join using this room code.
        </div>
      )}

      {/* Added to queue feedback */}
      <AnimatePresence>
        {addedFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[var(--accent-green)]/15 border border-[var(--accent-green)]/30 text-[var(--accent-green)] p-3 rounded-xl mb-4 text-center font-['Manrope'] text-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span><strong>"{addedFeedback}"</strong> added to queue!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue error feedback */}
      <AnimatePresence>
        {queueError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-500/15 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-center font-['Manrope'] text-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">error</span>
            <span>{queueError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Player Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--bg-glass-heavy)] border border-[var(--glass-border)] rounded-3xl p-6 md:p-10 backdrop-blur-xl relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-purple)]/5 to-transparent opacity-50"></div>
             
             <div className="relative z-10 text-center flex flex-col items-center">
                {/* ── Show the ROOM's current track, not the local player's ── */}
                {roomTrack ? (
                  <>
                    <img src={roomTrack.albumArt} alt="Artwork" className="w-64 h-64 rounded-2xl shadow-2xl mb-6 object-cover" />
                    <h2 className="text-3xl font-bold text-[var(--text-primary)] font-['Epilogue'] mb-2">{roomTrack.title}</h2>
                    <p className="text-[var(--text-secondary)] text-lg font-['Manrope'] mb-2">{roomTrack.artist}</p>
                    
                    {/* Playback state badge */}
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-6 ${
                      roomState === 'playing' 
                        ? 'bg-[var(--accent-green)]/15 text-[var(--accent-green)] border border-[var(--accent-green)]/30' 
                        : roomState === 'paused'
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'bg-[var(--surface-container-high)] text-[var(--text-muted)] border border-[var(--glass-border)]'
                    }`}>
                      <span className="material-symbols-outlined text-sm">
                        {roomState === 'playing' ? 'play_arrow' : roomState === 'paused' ? 'pause' : 'hourglass_empty'}
                      </span>
                      {roomState === 'playing' ? 'Now Playing' : roomState === 'paused' ? 'Paused' : 'Waiting'}
                    </div>

                    {/* ── Host Controls ── */}
                    {isHost && (
                      <div className="flex items-center gap-4 mb-6">
                        <button
                          onClick={() => playPause(roomState === 'playing' ? 'pause' : 'play')}
                          className="w-14 h-14 rounded-full bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/80 text-black flex items-center justify-center transition-all shadow-lg hover:shadow-xl hover:scale-105"
                          title={roomState === 'playing' ? 'Pause for everyone' : 'Play for everyone'}
                        >
                          <span className="material-symbols-outlined text-2xl">
                            {roomState === 'playing' ? 'pause' : 'play_arrow'}
                          </span>
                        </button>
                        <button
                          onClick={skipTrack}
                          className="w-11 h-11 rounded-full bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] border border-[var(--glass-border)] text-[var(--text-primary)] flex items-center justify-center transition-all hover:scale-105"
                          title="Skip to next track"
                        >
                          <span className="material-symbols-outlined text-xl">skip_next</span>
                        </button>
                      </div>
                    )}
                    
                    {/* ── Vote Skip (for all users) ── */}
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
                    <p className="text-[var(--text-secondary)] font-['Manrope'] mb-2">Queue is empty. Add a song to start jamming.</p>
                    <p className="text-[var(--text-muted)] text-sm font-['Manrope']">
                      {isHost ? 'Search and add songs using the panel on the right →' : 'Search and request songs using the panel on the right →'}
                    </p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Sidebar / Queue */}
        <div className="space-y-6">
          {/* ── Add to Queue (available for EVERYONE) ── */}
          <div className="bg-[var(--bg-glass-heavy)] border border-[var(--glass-border)] rounded-2xl p-6 backdrop-blur-xl">
             <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 font-['Manrope'] flex items-center gap-2">
               <span className="material-symbols-outlined text-sm">add_circle</span>
               {isHost ? 'Add to Queue' : 'Request a Song'}
             </h3>
             <SearchBar 
                onResults={setSearchResults}
                onLoading={setIsSearching}
                compact={true}
             />
             
             {/* Search Results */}
             {(searchResults?.tracks?.length > 0 || isSearching) && (
               <div className="mt-4 bg-[var(--surface-container-high)] rounded-xl p-2 max-h-60 overflow-y-auto custom-scrollbar">
                 {isSearching ? (
                   <p className="text-center text-xs text-[var(--text-muted)] py-4 flex justify-center"><span className="material-symbols-outlined animate-spin">refresh</span></p>
                 ) : (
                   <div className="flex flex-col gap-1">
                     {searchResults.tracks.slice(0, 10).map(track => (
                       <button
                         key={track.id}
                         disabled={addingToQueue}
                         onClick={async () => {
                           await handleAddToQueue(track);
                           setSearchResults(null);
                         }}
                         className={`flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-container-highest)] transition-colors text-left group/item ${addingToQueue ? 'opacity-50 pointer-events-none' : ''}`}
                       >
                         <img src={track.albumArt} alt="" className="w-8 h-8 rounded object-cover" />
                         <div className="flex-1 overflow-hidden">
                           <p className="text-sm font-medium text-[var(--text-primary)] truncate">{track.title}</p>
                           <p className="text-[10px] text-[var(--text-secondary)] truncate">{track.artist}</p>
                         </div>
                         <span className="material-symbols-outlined text-[var(--accent-green)] text-[18px] opacity-50 group-hover/item:opacity-100 transition-opacity">add_circle</span>
                       </button>
                     ))}
                   </div>
                 )}
               </div>
             )}
          </div>

          {/* ── Shared Queue ── */}
          <div className="bg-[var(--bg-glass-heavy)] border border-[var(--glass-border)] rounded-2xl p-6 backdrop-blur-xl h-[400px] flex flex-col">
             <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 font-['Manrope'] flex justify-between items-center">
               <span className="flex items-center gap-2">
                 <span className="material-symbols-outlined text-sm">queue_music</span>
                 Up Next
               </span>
               <span className="flex items-center gap-2">
                 <span className="text-[var(--text-secondary)]">{upcomingQueue.length} track{upcomingQueue.length !== 1 ? 's' : ''}</span>
                 <button 
                   onClick={refreshRoom} 
                   className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors" 
                   title="Sync queue"
                 >
                   <span className="material-symbols-outlined text-sm">sync</span>
                 </button>
               </span>
             </h3>
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
               {upcomingQueue.map((track, i) => (
                 <div key={`${track._queueIndex}-${track.id || i}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-container-high)] transition-colors group/qitem">
                    <div className="w-5 text-center text-xs text-[var(--text-muted)] font-bold">{i + 1}</div>
                    <img src={track.albumArt} alt="" className="w-10 h-10 rounded-md object-cover" />
                    <div className="flex-1 overflow-hidden">
                       <p className="text-sm font-bold text-[var(--text-primary)] truncate">{track.title}</p>
                       <p className="text-xs text-[var(--text-secondary)] truncate">
                         {track.artist}
                         {track.addedBy && (
                           <span className="text-[var(--text-muted)] ml-1">
                             • added by {track.addedBy.startsWith('guest_') ? 'Guest' : track.addedBy.slice(0, 6)}
                           </span>
                         )}
                       </p>
                    </div>
                    {/* Host can remove queue items */}
                    {isHost && (
                      <button
                        onClick={() => removeFromQueue(track._queueIndex)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 opacity-0 group-hover/qitem:opacity-100 hover:bg-red-500/20 transition-all"
                        title="Remove from queue"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                 </div>
               ))}
               {upcomingQueue.length === 0 && (
                 <div className="text-center text-[var(--text-muted)] text-sm mt-10 flex flex-col items-center gap-2">
                   <span className="material-symbols-outlined text-3xl opacity-30">queue_music</span>
                   <p>Queue is empty</p>
                   <p className="text-xs">Search above to add songs</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
