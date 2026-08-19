import React, { useEffect } from 'react';
import './WhyThisSongModal.css';

function formatEditorialTag(type) {
  switch (type) {
    case 'REPLAY_BEHAVIOR': return 'REPLAY PATTERN';
    case 'ARTIST_AFFINITY': return 'ARTIST AFFINITY';
    case 'GENRE_CONTINUITY': return 'GENRE CONTINUITY';
    case 'SAVED_PREFERENCE': return 'SAVED PREFERENCE';
    case 'SESSION_CONTINUITY': return 'SESSION FLOW';
    case 'DISCOVERY': return 'FRESH DISCOVERY';
    default: return 'SMART PICK';
  }
}

export default function WhyThisSongModal({ track, isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !track) return null;

  const reason = track.whyReason || {
    type: 'DISCOVERY',
    readableReason: 'Recommended based on your recent listening activity and genre preferences.',
    supportingData: { artist: track.artist, genre: track.genre },
  };

  const { type, readableReason, supportingData = {} } = reason;

  return (
    <>
      <div className="why-modal-overlay" onClick={onClose} />
      <div className="why-modal" role="dialog" aria-modal="true" aria-labelledby="why-modal-title">
        <button className="why-modal-close" onClick={onClose} aria-label="Close modal">
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="why-modal-header">
          <span className="why-tag">{formatEditorialTag(type)}</span>
          <h3 className="why-title" id="why-modal-title">Why Am I Hearing This?</h3>
        </div>

        <div className="why-track-preview">
          <img
            src={track.albumArt || track.cover || '/aurevon.jpg'}
            alt={track.title}
            className="why-track-art"
          />
          <div className="why-track-meta">
            <h4 className="why-track-title">{track.title}</h4>
            <p className="why-track-artist">{track.artist || track.artistName}</p>
          </div>
        </div>

        <div className="why-explanation-card">
          <div className="why-icon-box">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <p className="why-explanation-text">{readableReason}</p>
        </div>

        {supportingData.playCount > 0 && (
          <div className="why-evidence-row">
            <div className="why-evidence-item">
              <span className="why-evidence-value">{supportingData.playCount}</span>
              <span className="why-evidence-label">Previous Listens</span>
            </div>
            {supportingData.replayCount > 0 && (
              <div className="why-evidence-item">
                <span className="why-evidence-value">{supportingData.replayCount}</span>
                <span className="why-evidence-label">Replays</span>
              </div>
            )}
          </div>
        )}

        <div className="why-footer">
          <p className="why-disclaimer">
            Aurevon recommendations are calculated strictly from your actual listening signals.
          </p>
        </div>
      </div>
    </>
  );
}
