import { useState, memo, useCallback, useEffect } from 'react';
import usePlayer from '../hooks/usePlayer';
import Controls from './Controls';
import SeekBar from './SeekBar';
import VolumeControl from './VolumeControl';
import QueuePanel from './QueuePanel';
import NowPlaying from './NowPlaying';
import './PlayerBar.css';

const PlayerBar = memo(function PlayerBar({ onOpenLibrary, onAddToPlaylist }) {
  const { currentTrack, isLoading, isPlaying, errors, toggleLike, likedSongs, stopPlayback } = usePlayer();
  const [queueOpen, setQueueOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);

  const isCurrentLiked = currentTrack
    ? likedSongs.some((s) => s.id === currentTrack.id)
    : false;

  const handleLike = useCallback(() => {
    if (currentTrack) toggleLike(currentTrack);
  }, [currentTrack, toggleLike]);

  useEffect(() => {
    const handleOpen = () => setNowPlayingOpen(true);
    window.addEventListener('openNowPlaying', handleOpen);
    return () => window.removeEventListener('openNowPlaying', handleOpen);
  }, []);

  if (!currentTrack && !isLoading) return null;

  return (
    <>
      <div className={`player-dock-wrapper ${currentTrack ? 'is-visible' : ''}`}>
        <div className="player-dock">
          {/* Progress Bar (Layered on top of dock) */}
          <div className="player-dock__progress">
            <SeekBar />
          </div>

          <div className="player-dock__main">
            {/* Main Control Strip (The 10-button row) */}
            <div className="player-dock__strip">
              <div className="player-dock__art-mini" onClick={() => setNowPlayingOpen(true)}>
                {currentTrack?.albumArt ? (
                  <img src={currentTrack.albumArtSmall || currentTrack.albumArt} alt="" />
                ) : (
                  <span className="material-symbols-outlined">music_note</span>
                )}
                {!isLoading && isPlaying && (
                   <div className="player-dock__bars">
                      <span></span><span></span><span></span>
                   </div>
                )}
              </div>

              <div className="player-dock__controls-group">
                <Controls />
              </div>

              <div className="player-dock__actions-group">
                <button
                  className={`player-dock__btn ${isCurrentLiked ? 'is-liked' : ''}`}
                  onClick={handleLike}
                  title="Like"
                >
                  <span className="material-symbols-outlined">{isCurrentLiked ? 'favorite' : 'favorite'}</span>
                </button>

                <button
                  className="player-dock__btn"
                  onClick={() => {
                    if (currentTrack) {
                      const url = `${window.location.origin}/listen?song=${currentTrack.id}`;
                      navigator.clipboard.writeText(url)
                        .then(() => alert('Link copied to clipboard!'))
                        .catch(err => console.error('Failed to copy', err));
                    }
                  }}
                  title="Share Song"
                >
                  <span className="material-symbols-outlined">share</span>
                </button>
                
                <button
                  className={`player-dock__btn ${queueOpen ? 'is-active' : ''}`}
                  onClick={() => setQueueOpen(!queueOpen)}
                  title="Queue"
                >
                  <span className="material-symbols-outlined">queue_music</span>
                </button>

                <button
                  className="player-dock__btn"
                  onClick={onOpenLibrary}
                  title="Lyrics"
                >
                  <span className="material-symbols-outlined">lyrics</span>
                </button>

                <button
                  className="player-dock__btn player-dock__btn--close"
                  onClick={stopPlayback}
                  title="Close"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <QueuePanel isOpen={queueOpen} onClose={() => setQueueOpen(false)} />
      <NowPlaying 
        isOpen={nowPlayingOpen} 
        onClose={() => setNowPlayingOpen(false)} 
        onAddToPlaylist={onAddToPlaylist}
      />
    </>
  );
});

export default PlayerBar;
