import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useJam } from '../../context/JamContext';
import usePlayer from '../../hooks/usePlayer';

export default function Lobby() {
  const { createRoom, joinRoom, roomHistory } = useJam();
  const { userProfile } = usePlayer();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const name = userProfile?.name || 'Anonymous';
      await createRoom(name);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
      setLoading(false);
    }
  };

  const handleJoin = async (codeToJoin = roomCode) => {
    if (!codeToJoin) return;
    setLoading(true);
    setError(null);
    try {
      const name = userProfile?.name || 'Anonymous';
      await joinRoom(codeToJoin, name);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join room. It may not exist.');
      setLoading(false);
    }
  };

  return (
    <div className="jam-lobby">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--border-accent)] shadow-[0_0_30px_rgba(211,148,255,0.1)] mb-6">
          <span className="material-symbols-outlined text-[var(--accent-purple)] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>cell_tower</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] font-headline tracking-tighter uppercase mb-4">
          Jam Rooms
        </h1>
        <p className="text-[var(--text-secondary)] font-['Manrope'] text-lg max-w-lg mx-auto">
          Listen together in real-time. Share the queue, vote to skip, and sync your vibes perfectly.
        </p>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-8 text-center font-['Manrope']">
          {error}
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="jam-card flex flex-col items-center justify-center text-center h-full"
        >
          <span className="material-symbols-outlined text-4xl text-[var(--accent-green)] mb-4">group_add</span>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] font-['Epilogue'] mb-2">Host a Jam</h2>
          <p className="text-[var(--text-secondary)] font-['Manrope'] mb-8">Create a new room and invite your friends to listen together.</p>
          <button onClick={handleCreate} disabled={loading} className="jam-btn jam-btn-primary">
            {loading ? 'Starting...' : 'Start Session'}
          </button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="jam-card"
        >
          <div className="text-center mb-6">
             <span className="material-symbols-outlined text-4xl text-[var(--text-muted)] mb-4">login</span>
             <h2 className="text-2xl font-bold text-[var(--text-primary)] font-['Epilogue'] mb-2">Join a Jam</h2>
             <p className="text-[var(--text-secondary)] font-['Manrope']">Enter a 6-character room code to join an active session.</p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="e.g. AX72KD" 
              className="jam-input uppercase"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button 
              onClick={() => handleJoin()} 
              disabled={loading || roomCode.length < 6} 
              className="jam-btn jam-btn-secondary"
            >
              {loading ? 'Joining...' : 'Enter Room'}
            </button>
          </div>
        </motion.div>
      </div>

      {roomHistory.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 max-w-3xl mx-auto"
        >
          <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 font-['Manrope']">Recent Rooms</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {roomHistory.map((room) => (
              <button 
                key={room.roomId}
                onClick={() => handleJoin(room.roomCode)}
                className="bg-[var(--surface-container-low)] border border-[var(--glass-border)] hover:bg-[var(--surface-container-high)] hover:border-[var(--accent-purple)]/30 p-4 rounded-xl text-left transition-all"
              >
                <div className="text-[var(--accent-purple)] font-['Epilogue'] font-bold text-lg mb-1">{room.roomCode}</div>
                <div className="text-[var(--text-muted)] text-xs font-['Manrope'] truncate">Joined as {room.name}</div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
