import { memo } from 'react';
import usePlayer from '../hooks/usePlayer';
import TrackCard from './TrackCard';
import './Recommendations.css';

const MOOD_ICONS = {
  sad: '😢',
  chill: '😌',
  energetic: '⚡',
  romantic: '💕',
  aggressive: '🔥',
};

const ENERGY_LABELS = {
  low: 'Low Energy',
  medium: 'Medium Energy',
  high: 'High Energy',
};

const Recommendations = memo(function Recommendations({ onAddToPlaylist }) {
  const {
    recommendations,
    currentTrack,
    errors,
    recsUiText,
    recsMood,
    recsEnergy,
    recsReason,
    recsLoading,
  } = usePlayer();

  if (!currentTrack) return null;
  if (errors.recommendations && recommendations.length === 0) return null;

  return (
    <div className="recommendations">
      <h2 className="section-title">
        <svg viewBox="0 0 24 24" fill="currentColor" className="section-title__icon">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
        {recsMood ? 'AI Recommended' : 'Recommended'}
      </h2>

      {/* AI mood insights */}
      {recsMood && (
        <div className="recommendations__mood-bar">
          <span className="recommendations__mood-badge">
            {MOOD_ICONS[recsMood] || '🎵'} {recsMood}
          </span>
          {recsEnergy && (
            <span className="recommendations__energy-badge" data-energy={recsEnergy}>
              {ENERGY_LABELS[recsEnergy] || recsEnergy}
            </span>
          )}
        </div>
      )}

      {/* AI-generated UI text or fallback */}
      <p className="recommendations__subtitle">
        {recsUiText || `Based on the vibe of ${currentTrack.title}`}
      </p>

      {recsReason && (
        <p className="recommendations__reason">{recsReason}</p>
      )}

      {/* Loading state */}
      {recsLoading && recommendations.length === 0 && (
        <div className="recommendations__loading">
          <div className="recommendations__loading-dots">
            <span /><span /><span />
          </div>
          <span>AI is analyzing your vibe...</span>
        </div>
      )}

      {/* Track list */}
      {recommendations.length > 0 && (
        <div className="recommendations__list">
          {recommendations.map((track) => (
            <TrackCard key={track.id} track={track} onAddToPlaylist={onAddToPlaylist} />
          ))}
        </div>
      )}
    </div>
  );
});

export default Recommendations;
