import React, { useMemo } from 'react';
import usePlayer from '../hooks/usePlayer';
import { detectAurevonMoments } from '../services/intelligenceService';
import './AurevonMoments.css';

export default function AurevonMoments() {
  const playerState = usePlayer();

  const moments = useMemo(() => {
    return detectAurevonMoments(playerState);
  }, [playerState.listeningHistory, playerState.recentlyPlayed]);

  if (!moments || moments.length === 0) {
    return (
      <div className="moments-container">
        <div className="moments-header">
          <span className="moments-tag">LISTENING MEMORIES</span>
          <h3 className="moments-title">Aurevon Moments</h3>
        </div>
        <div className="moments-empty-card">
          <p className="moments-empty-text">
            Start listening to unlock Aurevon Moments. Your meaningful listening milestones and session patterns will appear here as memories.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="moments-container">
      <div className="moments-header">
        <span className="moments-tag">LISTENING MEMORIES</span>
        <h3 className="moments-title">Aurevon Moments</h3>
      </div>

      <div className="moments-grid">
        {moments.map((moment) => (
          <div
            key={moment.id}
            className="moment-card"
            style={{ '--accent-color': moment.accentColor || '#8b5cf6' }}
          >
            <div className="moment-card-header">
              <span className="moment-type-badge">[{moment.type}]</span>
              <span className="moment-date">{moment.subtitle}</span>
            </div>

            <h4 className="moment-card-title">{moment.title}</h4>
            <p className="moment-card-desc">{moment.description}</p>

            <div className="moment-card-stats">
              <div className="moment-stat-item">
                <span className="moment-stat-num">{moment.stats.durationMins}m</span>
                <span className="moment-stat-lbl">Duration</span>
              </div>
              <div className="moment-stat-item">
                <span className="moment-stat-num">{moment.stats.totalTracks}</span>
                <span className="moment-stat-lbl">Tracks</span>
              </div>
              <div className="moment-stat-item">
                <span className="moment-stat-num">{moment.stats.uniqueArtists}</span>
                <span className="moment-stat-lbl">Artists</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
