import { memo, useEffect, useMemo, useState } from 'react';
import usePlayer from '../hooks/usePlayer';
import { searchArtists } from '../services/spotifyService';
import TrackCard from './TrackCard';
import './Library.css';

const Library = memo(function Library({ initialTab, onAddToPlaylist }) {
  const { likedSongs, playlists, followedArtists, playTrack, setUserInteracted, openArtistProfile } = usePlayer();
  const [activeTab, setActiveTab] = useState('index');
  const [artistMetadata, setArtistMetadata] = useState({});
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  // Sync internal activeTab with initialTab (if provided)
  useEffect(() => {
    setActiveTab(initialTab || 'index');
  }, [initialTab]);

  // Library is now a main view, no body scroll lock needed here anymore
  // as it transitions within the main container.

  // Fetch metadata for ALL followed artists when Library is shown
  useEffect(() => {
    if (activeTab === 'index' && followedArtists.length > 0) {
      const fetchMetadata = async () => {
        setIsLoadingArtists(true);
        const newMetadata = { ...artistMetadata };
        
        // Fetch all at once for the dashboard
        await Promise.all(followedArtists.map(async (name) => {
          if (!newMetadata[name]) {
            try {
              const results = await searchArtists(name);
              if (results && results.length > 0) {
                newMetadata[name] = results.find(a => a.name.toLowerCase() === name.toLowerCase()) || results[0];
              }
            } catch (err) {
              console.error(`Failed to fetch metadata for ${name}:`, err);
            }
          }
        }));
        
        setArtistMetadata(newMetadata);
        setIsLoadingArtists(false);
      };
      fetchMetadata();
    }
  }, [activeTab, followedArtists]);

  // Determine what library to render based on activeTab
  const currentLibrary = useMemo(() => {
    if (activeTab === 'index') {
        return {
            mode: 'index',
            title: 'Your Library',
            icon: 'library_music',
            colorTheme: '#72fe8f'
        };
    } else if (activeTab === 'liked') {
        return {
            mode: 'tracks',
            title: 'Liked Songs',
            tracks: likedSongs,
            icon: 'favorite',
            emptyText: 'No liked songs yet',
            emptySub: 'Tap the heart icon on any track to save it here',
            colorTheme: '#d394ff'
        };
    } else if (activeTab === 'playlists') {
        return {
            mode: 'playlists',
            title: 'Your Playlists',
            items: playlists,
            icon: 'library_music',
            emptyText: 'No playlists created',
            emptySub: 'Tap the + icon in the Sidebar to create your first collection',
            colorTheme: '#72fe8f'
        };
    } else if (activeTab === 'artists') {
        return {
            mode: 'artists',
            title: 'Artists',
            items: followedArtists,
            icon: 'person',
            emptyText: 'No followed artists',
            emptySub: 'Follow artists to see them here',
            colorTheme: '#30D5FF'
        };
    } else {
        const found = playlists.find(p => p.id === activeTab);
        if (found) {
             return {
                 mode: 'tracks',
                 title: found.name,
                 tracks: found.tracks || [],
                 icon: 'library_music',
                 emptyText: 'This collection is empty',
                 emptySub: 'Add songs to your playlist while listening',
                 colorTheme: '#72fe8f'
             };
        }
        return {
            mode: 'index',
            title: 'Your Library',
            icon: 'library_music',
            colorTheme: '#72fe8f'
        };
    }
  }, [activeTab, likedSongs, playlists, followedArtists]);

  const handlePlayAll = () => {
    if (currentLibrary.tracks.length > 0) {
      setUserInteracted();
      playTrack(currentLibrary.tracks[0]);
    }
  };

  // Helper to generate a deterministic follower count for visual polish
  const getFollowerCount = (name) => {
    const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const count = (seed % 950) + 50; // 50k to 1M range
    if (count > 1000) return `${(count / 100).toFixed(1)}M Followers`;
    return `${count}K Followers`;
  };

  return (
      <div className="library-main-container">
        {/* Render logic remains same, but container is main-level */}
        {activeTab !== 'index' && (
          <div className="library-panel__header">
            <div className="library-panel__header-left">
              <button 
                onClick={() => setActiveTab('index')}
                className="library-panel__back-btn" 
                aria-label="Back to library menu"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <span className="material-symbols-outlined text-3xl" style={{ color: currentLibrary.colorTheme, fontVariationSettings: "'FILL' 1" }}>
                {currentLibrary.icon}
              </span>
              <h2 className="library-panel__title" style={{ marginLeft: '12px' }}>{currentLibrary.title}</h2>
            </div>
            <span className="library-panel__count">
              {currentLibrary.mode === 'tracks' 
                 ? `${currentLibrary.tracks.length} songs` 
                 : currentLibrary.mode === 'playlists' || currentLibrary.mode === 'artists'
                    ? `${currentLibrary.items.length} items`
                    : ''
              }
            </span>
          </div>
        )}

        {currentLibrary.mode !== 'index' && (
          <div className="library-panel__tabs">
            <button 
              className={`library-tab ${activeTab === 'liked' ? 'active' : ''}`}
              onClick={() => setActiveTab('liked')}
            >
              Liked
            </button>
            <button 
              className={`library-tab ${activeTab === 'playlists' || (!['liked','artists'].includes(activeTab) && playlists.some(p => p.id === activeTab)) ? 'active' : ''}`}
              onClick={() => setActiveTab('playlists')}
            >
              Playlists
            </button>
            <button 
              className={`library-tab ${activeTab === 'artists' ? 'active' : ''}`}
              onClick={() => setActiveTab('artists')}
            >
              Artists
            </button>
          </div>
        )}

        {currentLibrary.mode === 'tracks' && currentLibrary.tracks.length > 0 && (
          <div className="library-panel__actions">
            <button className="library-panel__play-all" onClick={handlePlayAll}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play All
            </button>
          </div>
        )}

        <div className="library-panel__list">
          {currentLibrary.mode === 'index' ? (
             <div className="library-panel__unified-dashboard px-4 py-6">
                {/* 1. Liked Songs Tile */}
                <button 
                   className="library-card library-card--featured"
                   onClick={() => setActiveTab('liked')}
                >
                   <div className="library-card__icon library-card__icon--liked">
                      <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                   </div>
                   <div className="library-card__info">
                      <h3>Liked Songs</h3>
                      <p>{likedSongs.length} Tracks Saved</p>
                   </div>
                </button>

                {/* 2. Unified Grid for Playlists */}
                {playlists.length > 0 && (
                   <div className="library-unified-grid">
                      {playlists.map(pl => (
                         <button 
                            key={pl.id}
                            className="library-card"
                            onClick={() => setActiveTab(pl.id)}
                         >
                            <div className="library-card__icon library-card__icon--playlist">
                               <span className="material-symbols-outlined text-4xl">library_music</span>
                            </div>
                            <div className="library-card__info">
                               <h3>{pl.name}</h3>
                               <p>{pl.tracks?.length || 0} tracks</p>
                            </div>
                         </button>
                      ))}
                   </div>
                )}

                {/* 3. Followed Artists — Vertical List (1 per line) */}
                {followedArtists.length > 0 && (
                   <div className="library-artist-section">
                      <div className="library-section-header">
                         <h3>Followed Artists</h3>
                         <span className="library-section-count">{followedArtists.length}</span>
                      </div>
                      <div className="library-artist-list">
                         {followedArtists.map(artistName => {
                            const meta = artistMetadata[artistName];
                            return (
                               <button 
                                  key={artistName}
                                  className="library-artist-row"
                                  onClick={() => meta && openArtistProfile(meta)}
                               >
                                  <div className="library-artist-row__left">
                                     <div className="library-artist-row__avatar">
                                        {meta?.image ? (
                                           <img src={meta.image} alt={artistName} className="w-full h-full object-cover" />
                                        ) : (
                                           <div className="w-full h-full flex items-center justify-center text-[#30D5FF] opacity-50 bg-[#30D5FF]/10">
                                              <span className="material-symbols-outlined text-2xl">person</span>
                                           </div>
                                        )}
                                     </div>
                                     <div className="library-artist-row__info">
                                        <div className="library-artist-row__name-wrap">
                                           <span className="library-artist-row__name">{artistName}</span>
                                           <span className="material-symbols-outlined text-blue-400 text-sm ml-1" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                        </div>
                                        <span className="library-artist-row__metrics">{getFollowerCount(artistName)}</span>
                                     </div>
                                  </div>
                                  <span className="material-symbols-outlined text-[#686880] text-xl">chevron_right</span>
                               </button>
                            );
                         })}
                      </div>
                   </div>
                )}

                {likedSongs.length === 0 && playlists.length === 0 && followedArtists.length === 0 && (
                   <div className="library-panel__empty">
                      <span className="material-symbols-outlined text-6xl opacity-30 mb-4">library_music</span>
                      <p>Your library is empty</p>
                      <span>Start liking songs and following artists to build your space</span>
                   </div>
                )}
             </div>
          ) : currentLibrary.mode === 'tracks' ? (
              currentLibrary.tracks.length === 0 ? (
                <div className="library-panel__empty">
                  <span className="material-symbols-outlined text-6xl opacity-30 mb-4">{currentLibrary.icon}</span>
                  <p>{currentLibrary.emptyText}</p>
                  <span>{currentLibrary.emptySub}</span>
                </div>
              ) : (
                currentLibrary.tracks.map((track) => (
                  <TrackCard key={track.id} track={track} onAddToPlaylist={onAddToPlaylist} />
                ))
              )
          ) : currentLibrary.mode === 'playlists' ? (
              currentLibrary.items.length === 0 ? (
                <div className="library-panel__empty">
                  <span className="material-symbols-outlined text-6xl opacity-30 mb-4">{currentLibrary.icon}</span>
                  <p>{currentLibrary.emptyText}</p>
                  <span>{currentLibrary.emptySub}</span>
                </div>
              ) : (
                  <div className="library-panel__grid px-4 py-2">
                      {currentLibrary.items.map(pl => (
                          <button 
                              key={pl.id}
                              onClick={() => setActiveTab(pl.id)}
                              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] hover:bg-white/5 border border-white/5 hover:border-[#72fe8f]/30 transition-all text-left mb-3 group"
                          >
                              <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-[#72fe8f]/10 group-hover:border-[#72fe8f]/20 transition-all">
                                  <span className="material-symbols-outlined text-2xl text-[#acaab1] group-hover:text-[#72fe8f]">library_music</span>
                              </div>
                              <div className="flex-1 overflow-hidden">
                                  <p className="font-['Epilogue'] font-bold text-white text-lg truncate group-hover:text-[#72fe8f] transition-colors">{pl.name}</p>
                                  <p className="font-['Manrope'] text-xs text-[#acaab1] uppercase tracking-widest">{pl.tracks?.length || 0} tracks</p>
                              </div>
                              <span className="material-symbols-outlined text-[#686880] group-hover:text-white transition-colors">chevron_right</span>
                          </button>
                      ))}
                  </div>
              )
          ) : (
              currentLibrary.items.length === 0 ? (
                <div className="library-panel__empty">
                  <span className="material-symbols-outlined text-6xl opacity-30 mb-4">{currentLibrary.icon}</span>
                  <p>{currentLibrary.emptyText}</p>
                  <span>{currentLibrary.emptySub}</span>
                </div>
              ) : (
                  <div className="library-panel__grid px-4 py-2">
                      {currentLibrary.items.map(artistName => {
                          const meta = artistMetadata[artistName];
                          return (
                              <button 
                                  key={artistName}
                                  onClick={() => meta && openArtistProfile(meta)}
                                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] hover:bg-white/5 border border-white/5 hover:border-[#30D5FF]/30 transition-all text-left mb-3 group"
                              >
                                  <div className="w-14 h-14 rounded-full overflow-hidden bg-white/5 border border-white/10 group-hover:border-[#30D5FF]/40 transition-all flex-shrink-0">
                                      {meta?.image ? (
                                          <img src={meta.image} alt={artistName} className="w-full h-full object-cover" />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center text-[#30D5FF] opacity-50">
                                              <span className="material-symbols-outlined text-2xl">person</span>
                                          </div>
                                      )}
                                  </div>
                                  <div className="flex-1 overflow-hidden">
                                      <p className="font-['Epilogue'] font-bold text-white text-lg truncate group-hover:text-[#30D5FF] transition-colors">{artistName}</p>
                                      <p className="font-['Manrope'] text-xs text-[#acaab1] uppercase tracking-widest">{meta?.genre || 'Artist'}</p>
                                  </div>
                                  <span className="material-symbols-outlined text-[#686880] group-hover:text-white transition-colors">chevron_right</span>
                              </button>
                          );
                      })}
                  </div>
              )
          )}
        </div>
      </div>
  );
});

export default Library;
