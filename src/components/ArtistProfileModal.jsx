import { useState, useEffect, memo } from 'react';
import usePlayer from '../hooks/usePlayer';
import { getArtistTopTracks } from '../services/spotifyService';
import './ArtistProfileModal.css';

const ArtistProfileModal = memo(function ArtistProfileModal({ artist, isOpen, onClose }) {
  const { playTrack, followedArtists, toggleFollowArtist, setUserInteracted } = usePlayer();
  const [topTracks, setTopTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const isFollowed = followedArtists.includes(artist.name);

  useEffect(() => {
    if (isOpen && artist.id) {
      const loadTracks = async () => {
        setIsLoading(true);
        const tracks = await getArtistTopTracks(artist.id);
        setTopTracks(tracks);
        setIsLoading(false);
      };
      loadTracks();
    }
  }, [isOpen, artist.id]);

  if (!isOpen) return null;

  const handlePlayTrack = (track) => {
    setUserInteracted();
    playTrack(track);
  };

  const handleToggleFollow = (e) => {
    e.stopPropagation();
    toggleFollowArtist(artist.name);
  };

  return (
    <>
      <div className="artist-profile-overlay" onClick={onClose} />
      <div className="artist-profile-modal">
        <button className="artist-profile-close" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <header className="artist-profile-header">
          <div className="artist-profile-banner">
            <img src={artist.image} alt={artist.name} className="artist-banner-img" />
            <div className="artist-banner-overlay" />
          </div>
          
          <div className="artist-profile-info">
            {artist.loading ? (
              <div className="artist-info-skeleton">
                <div className="skeleton-badge" />
                <div className="skeleton-name" />
                <div className="skeleton-meta" />
              </div>
            ) : (
              <>
                <div className="artist-profile-badge">Verified Artist</div>
                <h2 className="artist-profile-name">{artist.name}</h2>
                <div className="artist-profile-meta">
                  <span className="genre-tag">{artist.genre}</span>
                  <span className="monthly-listeners">1,234,567 monthly listeners</span>
                </div>
              </>
            )}
            
            <div className="artist-profile-actions">
              <button 
                className="artist-play-btn"
                onClick={() => topTracks.length > 0 && handlePlayTrack(topTracks[0])}
                disabled={topTracks.length === 0}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                Play Top Song
              </button>
              <button 
                className={`artist-follow-btn ${isFollowed ? 'is-followed' : ''}`}
                onClick={handleToggleFollow}
              >
                {isFollowed ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        </header>

        <section className="artist-top-tracks">
          <h3 className="tracks-heading">Top 10 Tracks</h3>
          <div className="tracks-list">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="track-skeleton" />
              ))
            ) : (
              topTracks.map((track, index) => (
                <div 
                  key={track.id} 
                  className="artist-track-item"
                  onClick={() => handlePlayTrack(track)}
                >
                  <span className="track-num">{index + 1}</span>
                  <div className="track-art-mini">
                    <img src={track.albumArtSmall} alt={track.title} />
                  </div>
                  <div className="track-details">
                    <span className="track-title">{track.title}</span>
                    <span className="track-album">{track.album}</span>
                  </div>
                  <button className="track-play-icon">
                    <span className="material-symbols-outlined">play_circle</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
});

export default ArtistProfileModal;
