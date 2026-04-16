import { memo, useState, useCallback } from 'react';
import TrackCard from './TrackCard';
import cacheService from '../services/cacheService';
import './BrowseCategories.css';

const categories = [
  { name: 'Pop', query: 'top pop hits 2025 playlist', subtitle: 'Pop • Updated daily', color: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)', icon: 'music_note' },
  { name: 'Hip-Hop', query: 'hip hop trending songs playlist', subtitle: 'Hip-Hop • Trending now', color: 'linear-gradient(135deg, #e91e63 0%, #ff5722 100%)', icon: 'headphones' },
  { name: 'Rock', query: 'rock classics playlist', subtitle: 'Rock • All-time classics', color: 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)', icon: 'electric_bolt' },
  { name: 'Chill', query: 'lofi chill beats', subtitle: 'Chill • Lofi & study', color: 'linear-gradient(135deg, #00897b 0%, #26a69a 100%)', icon: 'spa' },
  { name: 'Dance', query: 'dance party hits mix', subtitle: 'Dance • Party vibes', color: 'linear-gradient(135deg, #6a1b9a 0%, #ab47bc 100%)', icon: 'nightlife' },
  { name: 'R&B', query: 'rnb chill mix', subtitle: 'R&B • Smooth & soul', color: 'linear-gradient(135deg, #283593 0%, #5c6bc0 100%)', icon: 'favorite' },
  { name: 'Indie', query: 'indie rock discovery', subtitle: 'Indie • New sounds', color: 'linear-gradient(135deg, #4e342e 0%, #795548 100%)', icon: 'forest' },
  { name: 'Latin', query: 'latin hits 2025', subtitle: 'Latin • Hot & fresh', color: 'linear-gradient(135deg, #ef6c00 0%, #ffb74d 100%)', icon: 'local_fire_department' },
  { name: 'Sleep', query: 'ambient sleep music', subtitle: 'Sleep • Deep relaxation', color: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)', icon: 'dark_mode' },
  { name: 'Workout', query: 'high energy workout playlist', subtitle: 'Workout • Pure energy', color: 'linear-gradient(135deg, #d84315 0%, #ff7043 100%)', icon: 'fitness_center' },
  { name: 'Jazz', query: 'smooth jazz classics', subtitle: 'Jazz • Smooth night', color: 'linear-gradient(135deg, #4a148c 0%, #7b1fa2 100%)', icon: 'piano' },
  { name: 'Metal', query: 'heavy metal essentials', subtitle: 'Metal • Pure power', color: 'linear-gradient(135deg, #212121 0%, #424242 100%)', icon: 'bolt' },
];

const trendingHero = {
  title: 'Global Top 50',
  subtitle: 'The most played tracks right now',
  image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3cLmyfbZyTDmgDCJR9jZT0ABqIq8doePBKXbVjy2gkDvMN1Wd9I9HBvy0UI2JGGPwEIYoGa4uVfR2yYy1J6PWwTvSRERC1ZxjKGbOE117JojLuSZwPa6EkLSYN7802ImlbKQEyOv8gQ_q1Yp21R5gC3Bpsxk042trdjxX5yx7ejDWIQE79MsKnRGBN0fnLsvK8sInmBurUVmn9ibfRit7SmEgJ1UZhx6HF5n0I02uYFeZT0GtCYPKinMz3wPR7hgYVHM-JW5DMt_K',
};

const BrowseCategories = memo(function BrowseCategories() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCategoryTracks = useCallback(async (category) => {
    const cacheKey = `category:${category.name}`;
    const cached = cacheService.get('categoryResults', cacheKey);
    
    if (cached) {
      setTracks(cached);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${apiBase}/youtube/search?q=${encodeURIComponent(category.query)}`);
      if (!response.ok) throw new Error('Failed to fetch category tracks');
      
      const data = await response.json();
      const mappedTracks = data.map(video => ({
        id: video.id,
        title: video.title,
        artist: video.artist,
        albumArt: video.thumbnail,
        albumArtSmall: video.thumbnail,
        videoId: video.id,
        source: 'youtube'
      }));

      setTracks(mappedTracks);
      cacheService.set('categoryResults', cacheKey, mappedTracks);
    } catch (err) {
      console.error('Error fetching category tracks:', err);
      setError('Could not load tracks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    fetchCategoryTracks(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setTracks([]);
    setError(null);
  };

  if (selectedCategory) {
    return (
      <section className="browse-section">
        <div className="playlist-view">
          <header className="playlist-view__header">
            <button className="playlist-view__back" onClick={handleBack}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="playlist-view__info">
              <h2 className="playlist-view__title">{selectedCategory.name}</h2>
              <p className="playlist-view__subtitle">{selectedCategory.subtitle}</p>
            </div>
          </header>

          <div className="playlist-view__content">
            {isLoading ? (
              <div className="search-results__loading">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-art" />
                    <div className="skeleton-info">
                      <div className="skeleton-line skeleton-line--title" />
                      <div className="skeleton-line skeleton-line--subtitle" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="playlist-view__error">
                <p>{error}</p>
                <button onClick={() => fetchCategoryTracks(selectedCategory)}>Retry</button>
              </div>
            ) : (
              <div className="playlist-view__list">
                {tracks.map((track) => (
                  <TrackCard key={track.id} track={track} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="browse-section">
      {/* Trending Now Hero */}
      <div className="browse-section__trending">
        <div className="browse-section__trending-header">
          <h3 className="browse-section__heading">Trending Now</h3>
          <button className="browse-section__see-all">See All</button>
        </div>

        <div className="trending-hero">
          <img src={trendingHero.image} alt={trendingHero.title} loading="lazy" />
          <div className="trending-hero__overlay" />
          <div className="trending-hero__content">
            <h4 className="trending-hero__title">{trendingHero.title}</h4>
            <p className="trending-hero__subtitle">{trendingHero.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="browse-section__categories">
        <h3 className="browse-section__heading">Browse Categories</h3>
        <div className="category-grid">
          {categories.map((cat) => (
            <div 
              key={cat.name} 
              className={`category-card ${selectedCategory?.name === cat.name ? 'category-card--active' : ''}`} 
              style={{ background: cat.color }}
              onClick={() => handleCategoryClick(cat)}
            >
              <span className="category-card__name">{cat.name}</span>
              <span className="material-symbols-outlined category-card__icon">{cat.icon}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export default BrowseCategories;
