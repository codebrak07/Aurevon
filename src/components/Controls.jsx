import './Controls.css';
import { memo } from 'react';
import usePlayer from '../hooks/usePlayer';

const Controls = memo(function Controls() {
  const {
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    loopEnabled,
    toggleLoop,
    shuffleEnabled,
    toggleShuffle,
    isLoading,
  } = usePlayer();

  return (
    <div className="controls">
      <button
        className={`controls__btn controls__btn--shuffle ${
          shuffleEnabled ? 'controls__btn--active' : ''
        }`}
        onClick={toggleShuffle}
        aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}
        title={shuffleEnabled ? 'Shuffle On' : 'Shuffle Off'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
        </svg>
      </button>

      <button
        className={`controls__btn controls__btn--loop ${
          loopEnabled ? 'controls__btn--active' : ''
        }`}
        onClick={toggleLoop}
        aria-label={loopEnabled ? 'Disable loop' : 'Enable loop'}
        title={loopEnabled ? 'Loop On' : 'Loop Off'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11v-1a4 4 0 014-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v1a4 4 0 01-4 4H3" />
        </svg>
      </button>

      <button className="controls__btn" onClick={prevTrack} aria-label="Previous track">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      <button
        className="controls__btn controls__btn--play"
        onClick={togglePlay}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <div className="controls__spinner" />
        ) : isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <button className="controls__btn" onClick={nextTrack} aria-label="Next track">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      <div className="controls__spacer" />
    </div>
  );
});

export default Controls;
