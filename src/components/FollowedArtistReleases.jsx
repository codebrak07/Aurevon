import React, { useState, useEffect } from 'react';
import { getArtistLatestTracks } from '../services/spotifyService';
import TrackCard from './TrackCard';
import './FollowedArtistReleases.css';

export default function FollowedArtistReleases({ followedArtists = [], onAddToPlaylist }) {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visibleTracks = showAll ? tracks : tracks.slice(0, 5);

  useEffect(() => {
    if (followedArtists.length === 0) return;

    const fetchAllLatest = async () => {
      setIsLoading(true);
      try {
        // Fetch for up to 6 artists to keep performance high on home screen
        const topArtists = followedArtists.slice(0, 6);
        const results = await Promise.all(
          topArtists.map(artistName => getArtistLatestTracks(artistName))
        );
        
        // Flatten, unique, sort by release date
        const allTracks = results.flat();
        const uniqueTracks = Array.from(new Set(allTracks.map(t => t.id)))
          .map(id => allTracks.find(t => t.id === id));
        
        const sorted = uniqueTracks.sort((a, b) => 
          new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0)
        );

        setTracks(sorted.slice(0, 20)); // Show top 20 newest from favorites
      } catch (err) {
        console.error('Failed to fetch favorite releases:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllLatest();
  }, [followedArtists]);

  if (followedArtists.length === 0 || (!isLoading && tracks.length === 0)) return null;

  return (
    <section className="fav-releases">
      <div className="section-header">
        <div className="section-title">
          <span className="material-symbols-outlined section-title__icon">star</span>
          <span>Latest from Favorites</span>
        </div>
        {!isLoading && <span className="release-count">{tracks.length} new songs</span>}
      </div>

      <div className="fav-releases__list">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-track-list-item" />
            ))}
          </div>
        ) : (
          <>
            <div className="fav-releases__vertical-grid">
              {visibleTracks.map((track) => (
                <div key={track.id} className="fav-track-wrapper">
                  <TrackCard 
                    track={track} 
                    onAddToPlaylist={onAddToPlaylist}
                  />
                </div>
              ))}
            </div>
            
            {tracks.length > 5 && (
              <button 
                className="load-more-btn"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `Load More (${tracks.length - 5} more)`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
