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
  const { followedArtists, likedSongs, playTrack, setUserInteracted } = usePlayer();
  const [featured, setFeatured] = useState(DEFAULT_FEATURED);
  const [trending, setTrending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPersonalized, setIsPersonalized] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Trending Songs
      const trendingResults = await getTrendingSongs();
      setTrending(trendingResults.slice(0, 5));

      // 2. Identify Seed Artists (Followed + Liked Artists)
      const likedArtists = [...new Set(likedSongs.map(s => s.artist))];
      const allSeedArtists = [...new Set([...followedArtists, ...likedArtists])];

      if (allSeedArtists.length > 0) {
        // Pick 3 random seed artists to check for new releases
        const randomArtists = [...allSeedArtists]
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);
        
        let foundRelease = null;
        for (const artist of randomArtists) {
          const releases = await getArtistLatestReleases(artist);
          if (releases.length > 0) {
            foundRelease = releases[0];
            break;
          }
        }

        if (foundRelease) {
          // Improve thumbnail quality (YouTube maxres)
          const hqArt = foundRelease.thumbnail.replace('default.jpg', 'maxresdefault.jpg');
          
          setFeatured({
            label: 'NEW RELEASE',
            title: foundRelease.title,
            artist: foundRelease.channelTitle || foundRelease.artist,
            desc: `Fresh drop from ${foundRelease.channelTitle || foundRelease.artist}. Based on your favorites.`,
            image: hqArt,
            track: foundRelease
          });
          setIsPersonalized(true);
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
  }, [followedArtists, likedSongs]);

  const useTrendingAsFeatured = (track) => {
    setFeatured({
      label: 'TRENDING NOW',
      title: track.title,
      artist: track.channelTitle || track.artist,
      desc: `Currently trending worldwide. Don't miss this hit!`,
      image: track.thumbnail,
      track: track 
    });
    setIsPersonalized(false);
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
              <img 
                src={featured.image} 
                alt={featured.title} 
                loading="lazy" 
                onError={(e) => {
                  // Fallback if maxresdefault doesn't exist
                  if (e.target.src.includes('maxresdefault.jpg')) {
                    e.target.src = e.target.src.replace('maxresdefault.jpg', 'hqdefault.jpg');
                  }
                }}
              />
              <div className="featured-album__overlay" />
            </div>
            <div className="featured-album__content">
              {isPersonalized && (
                <span className="new-releases__tag">Picked for you ❤️</span>
              )}
              {!isPersonalized && !isLoading && (
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

    </section>
  );
});

export default NewReleases;
