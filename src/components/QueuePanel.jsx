import { memo, useEffect, useState } from 'react';
import usePlayer from '../hooks/usePlayer';
import WhyThisSongModal from './WhyThisSongModal';
import './QueuePanel.css';

const QueuePanel = memo(function QueuePanel({ isOpen, onClose }) {
  const {
    queue,
    currentIndex,
    currentTrack,
    removeFromQueue,
    clearQueue,
    playTrack,
    setUserInteracted,
    smartPicks = [],
    dismissSmartPick,
    enqueueSmartPick,
  } = usePlayer();

  const [selectedWhyTrack, setSelectedWhyTrack] = useState(null);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      <div
        className={`queue-overlay ${isOpen ? 'queue-overlay--visible' : ''}`}
        onClick={onClose}
      />
      <div className={`queue-panel ${isOpen ? 'queue-panel--open' : ''}`}>
        <div className="queue-panel__header">
          <div className="queue-panel__header-main">
            <h2 className="queue-panel__title">Queue</h2>
            <span className="queue-panel__count">{queue.length} tracks</span>
          </div>
          <div className="queue-panel__header-actions">
            {queue.length > 0 && (
              <button 
                className="queue-panel__clear-btn" 
                onClick={clearQueue}
              >
                Clear All
              </button>
            )}
            <button className="queue-panel__close" onClick={onClose} aria-label="Close queue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="queue-panel__list">
          <div className="queue-section-header">
            <span className="queue-section-tag">UP NEXT QUEUE</span>
            <h4 className="queue-section-title">UP NEXT</h4>
          </div>

          {queue.length === 0 ? (
            <div className="queue-panel__empty">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
              <p>Your queue is empty</p>
              <span>Play or add tracks to see them here</span>
            </div>
          ) : (
            queue.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                className={`queue-item ${index === currentIndex ? 'queue-item--active' : ''} ${
                  index < currentIndex ? 'queue-item--played' : ''
                }`}
                onClick={() => {
                  setUserInteracted();
                  playTrack(track);
                }}
              >
                <span className="queue-item__index">
                  {index === currentIndex ? (
                    <span className="queue-item__playing">
                      <span /><span /><span />
                    </span>
                  ) : (
                    index + 1
                  )}
                </span>

                {track.albumArtSmall || track.albumArt ? (
                  <img
                    className="queue-item__art"
                    src={track.albumArtSmall || track.albumArt}
                    alt={track.album}
                    loading="lazy"
                  />
                ) : (
                  <div className="queue-item__art queue-item__art--placeholder" />
                )}

                <div className="queue-item__info">
                  <span className="queue-item__title">{track.title}</span>
                  <span className="queue-item__artist">{track.artist}</span>
                </div>

                <button
                  className="queue-item__remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromQueue(index);
                  }}
                  aria-label="Remove from queue"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}

          {/* Intelligent Picks Section */}
          {smartPicks.length > 0 && (
            <div className="smart-picks-section">
              <div className="queue-section-header smart-picks-header">
                <span className="queue-section-tag">AUREVON PICKS</span>
                <h4 className="queue-section-title">AUREVON'S PICKS</h4>
              </div>

              {smartPicks.map((track, sIdx) => (
                <div
                  key={`smart-pick-${track.id || track.title}-${sIdx}`}
                  className="queue-item smart-pick-item"
                  onClick={() => {
                    setUserInteracted();
                    playTrack(track);
                  }}
                >
                  <img
                    className="queue-item__art"
                    src={track.albumArt || track.cover || '/aurevon.jpg'}
                    alt={track.title}
                  />

                  <div className="queue-item__info">
                    <div className="smart-pick-title-row">
                      <span className="queue-item__title">{track.title}</span>
                    </div>
                    <span className="queue-item__artist">{track.artist || track.artistName}</span>
                  </div>

                  <div className="smart-pick-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="smart-why-btn"
                      title="Why this song?"
                      onClick={() => setSelectedWhyTrack(track)}
                    >
                      Why?
                    </button>

                    <button
                      className="smart-add-btn"
                      title="Add to Up Next"
                      onClick={() => enqueueSmartPick(sIdx)}
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>

                    <button
                      className="queue-item__remove"
                      title="Dismiss pick"
                      onClick={() => dismissSmartPick(sIdx)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WhyThisSongModal
        track={selectedWhyTrack}
        isOpen={Boolean(selectedWhyTrack)}
        onClose={() => setSelectedWhyTrack(null)}
      />
    </>
  );
});

export default QueuePanel;
