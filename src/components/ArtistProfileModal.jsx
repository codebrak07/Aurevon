import { useState, useEffect, memo } from 'react';
import usePlayer from '../hooks/usePlayer';
import { getArtistTopTracks } from '../services/musicService';
import { getArtistUserAffinity } from '../services/intelligenceService';
import './ArtistProfileModal.css';

const ArtistProfileModal = memo(function ArtistProfileModal({ artist, isOpen, onClose }) {
  const playerState = usePlayer();
  const { playTrack, followedArtists, toggleFollowArtist, setUserInteracted } = playerState;
  const [topTracks, setTopTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const isFollowed = followedArtists.includes(artist.name);
  const userAffinity = isOpen && artist.name ? getArtistUserAffinity(artist.name, playerState) : null;

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

        {/* Personalized Artist Intelligence Section */}
        {userAffinity && (
          <section className="artist-affinity-section">
            <div className="affinity-header">
              <span className="affinity-tag">YOUR LISTENING</span>
              <h3 className="affinity-heading">PERSONAL AFFINITY</h3>
            </div>

            <div className="affinity-insight-card">
              <span className="material-symbols-outlined insight-icon">auto_awesome</span>
              <p className="insight-text">{userAffinity.editorialInsight}</p>
            </div>

            {userAffinity.hasHistory && (
              <div className="affinity-stats-grid">
                <div className="affinity-stat-card">
                  <span className="stat-val">{userAffinity.playCount}</span>
                  <span className="stat-lbl">Plays</span>
                </div>
                <div className="affinity-stat-card">
                  <span className="stat-val">{userAffinity.totalMinutesListened}m</span>
                  <span className="stat-lbl">Time Listened</span>
                </div>
                <div className="affinity-stat-card">
                  <span className="stat-val">{userAffinity.playlistCount}</span>
                  <span className="stat-lbl">In Playlists</span>
                </div>
              </div>
            )}
          </section>
        )}

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
