import { useState, memo, useCallback, useEffect } from 'react';
import usePlayer from '../hooks/usePlayer';
import Controls from './Controls';
import SeekBar from './SeekBar';
import VolumeControl from './VolumeControl';
import QueuePanel from './QueuePanel';
import NowPlaying from './NowPlaying';
import './PlayerBar.css';

const PlayerBar = memo(function PlayerBar({ onOpenLibrary, onAddToPlaylist }) {
  const { currentTrack, isLoading, errors, toggleLike, likedSongs } = usePlayer();
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
            {/* Track Mini Info */}
            <div className="player-dock__track" onClick={() => setNowPlayingOpen(true)}>
              <div className="player-dock__art-wrapper">
                {currentTrack?.albumArt ? (
                  <img src={currentTrack.albumArtSmall || currentTrack.albumArt} alt="" />
                ) : (
                  <span className="material-symbols-outlined">music_note</span>
                )}
                {/* Playing Animation */}
                {!isLoading && currentTrack && (
                   <div className="player-dock__playing-icon">
                      <span></span><span></span><span></span>
                   </div>
                )}
              </div>
              <div className="player-dock__info">
                <span className="player-dock__title">{currentTrack?.title || 'Loading...'}</span>
                <span className="player-dock__artist">{currentTrack?.artist || 'Unknown'}</span>
              </div>
            </div>

            {/* Core Controls */}
            <div className="player-dock__controls">
              <Controls />
            </div>

            {/* Action Group */}
            <div className="player-dock__actions">
              <button
                className={`player-dock__btn ${isCurrentLiked ? 'is-liked' : ''}`}
                onClick={handleLike}
              >
                <span className="material-symbols-outlined">
                  {isCurrentLiked ? 'favorite' : 'favorite'}
                </span>
              </button>
              
              <button
                className={`player-dock__btn ${queueOpen ? 'is-active' : ''}`}
                onClick={() => setQueueOpen(!queueOpen)}
              >
                <span className="material-symbols-outlined">queue_music</span>
              </button>

              <button
                className="player-dock__btn"
                onClick={onOpenLibrary}
              >
                <span className="material-symbols-outlined">library_music</span>
              </button>
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
