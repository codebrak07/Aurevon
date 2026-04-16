import { useContext } from 'react';
import { PlayerContext } from '../context/PlayerContext';

export default function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
}
