import { memo, useCallback } from 'react';
import usePlayer from '../hooks/usePlayer';
import { formatDuration } from '../utils/mappers';
import './TrackCard.css';

const TrackCard = memo(function TrackCard({ track, showAdd = true, onAddToPlaylist }) {
  const { 
    playTrack, 
    addToQueue, 
    currentTrack, 
    setUserInteracted, 
    toggleLike, 
    likedSongs,
    followedArtists,
    toggleFollowArtist,
    openArtistProfile,
  } = usePlayer();

  const isActive = currentTrack?.id === track.id;
  const isLiked = likedSongs.some((s) => s.id === track.id);
  const isFollowing = followedArtists.includes(track.artist);

  const handlePlay = useCallback(() => {
    setUserInteracted();
    playTrack(track);
  }, [track, playTrack, setUserInteracted]);

  const handleArtClick = useCallback((e) => {
    e.stopPropagation();
    setUserInteracted();
    playTrack(track); // Start playing immediately
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openNowPlaying'));
    }, 50); // slight delay to allow currentTrack to update
  }, [track, playTrack, setUserInteracted]);

  const handleAddToPlaylist = useCallback(
    (e) => {
      e.stopPropagation();
      if (onAddToPlaylist) {
        onAddToPlaylist(track);
      }
    },
    [track, onAddToPlaylist]
  );

  const handleLike = useCallback(
    (e) => {
      e.stopPropagation();
      toggleLike(track);
    },
    [track, toggleLike]
  );

  const handleAddToQueue = useCallback(
    (e) => {
      e.stopPropagation();
      addToQueue(track);
    },
    [track, addToQueue]
  );

  const handleFollowArtist = useCallback(
    (e) => {
      e.stopPropagation();
      toggleFollowArtist(track.artist);
    },
    [track.artist, toggleFollowArtist]
  );

  const handleArtistClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (track.artistId) {
        openArtistProfile({ id: track.artistId, name: track.artist });
      }
    },
    [track.artistId, track.artist, openArtistProfile]
  );

  return (
    <div
      className={`track-card ${isActive ? 'track-card--active' : ''}`}
      onClick={handlePlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
    >
      <div 
        className="track-card__art-wrapper" 
        onClick={handleArtClick}
        aria-label={`Play and open ${track.title}`}
        title={`Play and open ${track.title}`}
      >
        {track.albumArtSmall || track.albumArt ? (
          <img
            className="track-card__art"
            src={track.albumArtSmall || track.albumArt}
            alt={track.album}
            loading="lazy"
          />
        ) : (
          <div className="track-card__art track-card__art--placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
        {isActive && (
          <div className="track-card__playing-indicator">
            <span /><span /><span />
          </div>
        )}
      </div>

      <div className="track-card__info">
        <span className="track-card__title font-hero">{track.title}</span>
        <div className="track-card__artist-row">
          <span 
            className="track-card__artist hover:text-primary active:scale-95 transition-all cursor-pointer"
            onClick={handleArtistClick}
          >
            {track.artist}
          </span>
          <button 
            className={`track-card__follow-btn ${isFollowing ? 'is-following' : ''}`}
            onClick={handleFollowArtist}
            title={isFollowing ? `Unfollow ${track.artist}` : `Follow ${track.artist}`}
            aria-label={isFollowing ? `Unfollow ${track.artist}` : `Follow ${track.artist}`}
          >
            {isFollowing ? '❤️' : '🤍'}
          </button>
        </div>
      </div>

      <div className="track-card__actions">
        {track.duration > 0 && (
          <span className="track-card__duration">{formatDuration(track.duration)}</span>
        )}
        <button
          className={`track-card__like-btn ${isLiked ? 'track-card__like-btn--liked' : ''}`}
          onClick={handleLike}
          aria-label={isLiked ? 'Unlike' : 'Like'}
          title={isLiked ? 'Remove from Library' : 'Add to Library'}
        >
          <svg viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
        <button
          className="track-card__queue-btn"
          onClick={handleAddToQueue}
          aria-label="Add to Queue"
          title="Add to Queue"
        >
          <span className="material-symbols-outlined text-[20px]">queue_music</span>
        </button>
        {onAddToPlaylist && (
          <button
            className="track-card__more-btn"
            onClick={handleAddToPlaylist}
            aria-label="More options"
            title="More options"
          >
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>
        )}
      </div>
    </div>
  );
});

export default TrackCard;
