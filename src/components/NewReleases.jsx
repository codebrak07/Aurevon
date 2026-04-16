import { memo, useState, useEffect, useCallback } from 'react';
import usePlayer from '../hooks/usePlayer';
import { getTrendingSongs, getArtistLatestReleases } from '../services/youtubeService';
import './NewReleases.css';

const DEFAULT_FEATURED = {
  label: 'NEW ALBUM',
  title: 'Midnight Echoes',
  artist: 'Synthwave Collective',
  desc: 'The latest masterpiece from Synthwave Collective. Immerse yourself in the sound of the future.',
  image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=800&h=450',
};

const NewReleases = memo(function NewReleases() {
  const { followedArtists, playTrack, setUserInteracted } = usePlayer();
  const [featured, setFeatured] = useState(DEFAULT_FEATURED);
  const [trending, setTrending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFeaturedFromFollowed, setIsFeaturedFromFollowed] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Trending Songs
      const trendingResults = await getTrendingSongs();
      setTrending(trendingResults.slice(0, 5));

      // 2. Fetch Featured (Followed Artist or Top Trending)
      if (followedArtists.length > 0) {
        // Pick 2 random followed artists to check for new releases
        const randomArtists = [...followedArtists]
          .sort(() => 0.5 - Math.random())
          .slice(0, 2);
        
        let foundRelease = null;
        for (const artist of randomArtists) {
          const releases = await getArtistLatestReleases(artist);
          if (releases.length > 0) {
            foundRelease = releases[0];
            break;
          }
        }

        if (foundRelease) {
          setFeatured({
            label: 'NEW RELEASE',
            title: foundRelease.title,
            artist: foundRelease.channelTitle || foundRelease.artist,
            desc: `Check out the latest release from ${foundRelease.channelTitle || foundRelease.artist}.`,
            image: foundRelease.thumbnail,
            track: foundRelease
          });
          setIsFeaturedFromFollowed(true);
        } else if (trendingResults.length > 0) {
          useTrendingAsFeatured(trendingResults[0]);
        }
      } else if (trendingResults.length > 0) {
        useTrendingAsFeatured(trendingResults[0]);
      }
    } catch (err) {
      console.error('Failed to load dynamic new releases:', err);
    } finally {
      setIsLoading(false);
    }
  }, [followedArtists]);

  const useTrendingAsFeatured = (track) => {
    setFeatured({
      label: 'TRENDING NOW',
      title: track.title,
      artist: track.channelTitle || track.artist,
      desc: `Currently trending worldwide. Don't miss this hit!`,
      image: track.thumbnail,
      track: track 
    });
    setIsFeaturedFromFollowed(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePlayFeatured = () => {
    if (!featured.track) return;
    setUserInteracted();
    playTrack(featured.track);
  };

  const handlePlayTrending = (track) => {
    setUserInteracted();
    playTrack(track);
  };

  return (
    <section className="new-releases">
      <div className="new-releases__header">
        <h3 className="new-releases__heading">New Releases for You</h3>
      </div>

      {/* Featured Album Bento Card */}
      <div 
        className={`featured-album ${isLoading ? 'is-loading' : ''}`}
        onClick={handlePlayFeatured}
      >
        {!isLoading && (
          <>
            <div className="featured-album__art">
              <img src={featured.image} alt={featured.title} loading="lazy" />
              <div className="featured-album__overlay" />
            </div>
            <div className="featured-album__content">
              {isFeaturedFromFollowed && (
                <span className="new-releases__tag">From artists you follow ❤️</span>
              )}
              {!isFeaturedFromFollowed && !isLoading && (
                <span className="new-releases__tag">Trending Now 🔥</span>
              )}
              <span className="featured-album__label">{featured.label}</span>
              <h3 className="featured-album__title">{featured.title}</h3>
              <p className="featured-album__desc">{featured.desc}</p>
              <button 
                className="featured-album__play-btn"
                onClick={(e) => { e.stopPropagation(); handlePlayFeatured(); }}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                Play Now
              </button>
            </div>
          </>
        )}
      </div>

      {/* Trending Singles */}
      <div className="new-releases__trending">
        <div className="new-releases__trending-label">
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent-green)' }}>trending_up</span>
          <span>TRENDING SINGLES</span>
        </div>
        <div className="trending-list">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="trending-item is-loading">
                <div className="trending-item__rank" />
                <div className="trending-item__art" />
                <div className="trending-item__info" />
              </div>
            ))
          ) : (
            trending.map((track, index) => (
              <div 
                key={track.videoId} 
                className="trending-item"
                onClick={() => handlePlayTrending(track)}
              >
                <span className="trending-item__rank">{index + 1}</span>
                <div className="trending-item__art">
                  <img src={track.thumbnail} alt={track.title} loading="lazy" />
                </div>
                <div className="trending-item__info">
                  <span className="trending-item__title">{track.title}</span>
                  <span className="trending-item__artist">{track.channelTitle || track.artist}</span>
                </div>
                <button className="trending-item__more" aria-label="More options">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
});

export default NewReleases;
