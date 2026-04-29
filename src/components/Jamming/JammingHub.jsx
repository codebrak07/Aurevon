import React from 'react';
import { useJam } from '../../context/JamContext';
import Lobby from './Lobby';
import LiveRoom from './LiveRoom';
import './Jamming.css';

export default function JammingHub() {
  const { roomId } = useJam();

  return (
    <div className="jam-hub-container">
      {roomId ? <LiveRoom /> : <Lobby />}
    </div>
  );
}
