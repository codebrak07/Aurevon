import React, { useState, useEffect } from 'react';
import usePlayer from '../hooks/usePlayer';
import { useJam } from '../context/JamContext';
import { computeMusicMatch } from '../services/intelligenceService';
import './MusicMatchModal.css';

export default function MusicMatchModal({ friendProfile, isOpen, onClose, onJamStarted }) {
  const playerState = usePlayer();
  const jamCtx = useJam();
  const [isCreatingJam, setIsCreatingJam] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultFriend = friendProfile || {
    userProfile: { name: 'Alex' },
    likedSongs: playerState.likedSongs?.slice(0, 3) || [],
    playlists: playerState.playlists || [],
  };

  const matchData = computeMusicMatch(playerState, defaultFriend);
  const { overallMatch, breakdown, sharedArtists, summary } = matchData;

  const handleStartJam = async () => {
    setIsCreatingJam(true);
    try {
      if (jamCtx?.createRoom) {
        const roomCode = await jamCtx.createRoom(`Match Jam - ${defaultFriend.userProfile?.name || 'Friend'}`);
        if (onJamStarted) onJamStarted(roomCode);
      }
    } catch (err) {
      console.warn('[MusicMatch] Jam creation warning:', err);
    } finally {
      setIsCreatingJam(false);
      onClose();
    }
  };

  return (
    <>
      <div className="match-modal-overlay" onClick={onClose} />
      <div className="match-modal" role="dialog" aria-modal="true" aria-labelledby="match-title-id">
        <button className="match-modal-close" onClick={onClose} aria-label="Close modal">
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="match-header">
          <span className="match-tag">TASTE COMPATIBILITY</span>
          <h3 className="match-title" id="match-title-id">Musical Compatibility</h3>
        </div>

        <div className="match-score-hero">
          <div className="match-score-badge">
            <span className="match-score-num">{overallMatch}%</span>
            <span className="match-score-label">Taste Overlap</span>
          </div>

          <div className="match-profiles-row">
            <div className="match-avatar-wrapper">
              {playerState.userProfile?.image ? (
                <img src={playerState.userProfile.image} alt="You" className="match-avatar" />
              ) : (
                <div className="match-avatar-placeholder">You</div>
              )}
            </div>
            <span className="match-x">×</span>
            <div className="match-avatar-wrapper">
              <div className="match-avatar-placeholder">
                {(defaultFriend.userProfile?.name || 'F')[0]}
              </div>
            </div>
          </div>
        </div>

        <p className="match-summary">{summary}</p>

        <div className="match-breakdown-list">
          <div className="breakdown-item">
            <div className="breakdown-info">
              <span>Shared Artists</span>
              <span>{breakdown.sharedArtistsScore}%</span>
            </div>
            <div className="breakdown-bar">
              <div className="breakdown-fill" style={{ width: `${breakdown.sharedArtistsScore}%` }} />
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-info">
              <span>Genre Overlap</span>
              <span>{breakdown.genreOverlapScore}%</span>
            </div>
            <div className="breakdown-bar">
              <div className="breakdown-fill" style={{ width: `${breakdown.genreOverlapScore}%` }} />
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-info">
              <span>Favorite Track Alignment</span>
              <span>{breakdown.favoriteOverlapScore}%</span>
            </div>
            <div className="breakdown-bar">
              <div className="breakdown-fill" style={{ width: `${breakdown.favoriteOverlapScore}%` }} />
            </div>
          </div>
        </div>

        {sharedArtists.length > 0 && (
          <div className="shared-artists-box">
            <span className="shared-artists-label">Top Shared Artists</span>
            <div className="shared-chips">
              {sharedArtists.map((artist, i) => (
                <span key={i} className="artist-chip">
                  {artist}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="match-actions">
          <button
            className="start-jam-btn"
            onClick={handleStartJam}
            disabled={isCreatingJam}
          >
            <span className="material-symbols-outlined">equalizer</span>
            {isCreatingJam ? 'Creating Jam Room...' : 'Start a Jam Room'}
          </button>
        </div>
      </div>
    </>
  );
}
