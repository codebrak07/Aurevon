import { memo } from 'react';
import usePlayer from '../hooks/usePlayer';
import './ArtistCard.css';

const ArtistCard = memo(function ArtistCard({ artist, onSelect }) {
  const { followedArtists, toggleFollowArtist } = usePlayer();
  const isFollowed = followedArtists.includes(artist.name);

  const handleFollow = (e) => {
    e.stopPropagation();
    toggleFollowArtist(artist.name);
  };

  return (
    <div className="artist-card" onClick={onSelect}>
      <div className="artist-card__art">
        <img src={artist.image} alt={artist.name} />
      </div>
      <div className="artist-card__info">
        <span className="artist-card__name">{artist.name}</span>
        <span className="artist-card__type">Artist • {artist.genre}</span>
      </div>
      <button 
        className={`artist-card__follow-btn ${isFollowed ? 'is-followed' : ''}`}
        onClick={handleFollow}
      >
        {isFollowed ? 'Following' : 'Follow'}
      </button>
    </div>
  );
});

export default ArtistCard;
