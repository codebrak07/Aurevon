import TrackCard from './TrackCard';
import ArtistCard from './ArtistCard';
import './SearchResults.css';

export default function SearchResults({ results, isLoading, error, onAddToPlaylist, onArtistSelect }) {
  if (error) {
    return (
      <div className="search-results__error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <p>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="search-results__loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-art" />
            <div className="skeleton-info">
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line skeleton-line--subtitle" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const { tracks = [], artists = [] } = results || {};
  if (tracks.length === 0 && artists.length === 0) return null;

  // Only show the top (first) artist match as requested
  const topArtist = artists.length > 0 ? artists[0] : null;

  return (
    <div className="search-results">
      {topArtist && (
        <section className="search-results__section">
          <h2 className="section-title">Top Result</h2>
          <div className="search-results__artists-grid">
            <ArtistCard 
              artist={topArtist} 
              onSelect={() => onArtistSelect(topArtist)} 
            />
          </div>
        </section>
      )}

      {tracks.length > 0 && (
        <section className="search-results__section">
          <h2 className="section-title">Songs</h2>
          <div className="search-results__list">
            {tracks.map((track) => (
              <TrackCard key={track.id} track={track} onAddToPlaylist={onAddToPlaylist} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
