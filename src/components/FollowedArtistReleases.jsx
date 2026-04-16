import React, { useState, useEffect } from 'react';
import { getArtistLatestTracks } from '../services/spotifyService';
import TrackCard from './TrackCard';
import './FollowedArtistReleases.css';

export default function FollowedArtistReleases({ followedArtists = [], onAddToPlaylist }) {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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

      <div className="fav-releases__scroll-container hide-scrollbar">
        {isLoading ? (
          <div className="flex gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-track-card" />
            ))}
          </div>
        ) : (
          <div className="fav-releases__grid">
            {tracks.map((track) => (
              <TrackCard 
                key={track.id} 
                track={track} 
                onAddToPlaylist={onAddToPlaylist}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
