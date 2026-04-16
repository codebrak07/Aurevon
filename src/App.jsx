import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerProvider } from './context/PlayerContext';
import usePlayer from './hooks/usePlayer';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import PlayerBar from './components/PlayerBar';
import Recommendations from './components/Recommendations';
import MagicVibe from './components/MagicVibe';
import QuickLibrary from './components/QuickLibrary';
import HomeGreeting from './components/HomeGreeting';
import TopMixes from './components/TopMixes';
import NewReleases from './components/NewReleases';
import BrowseCategories from './components/BrowseCategories';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import ProfileModal from './components/ProfileModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import FollowedArtistReleases from './components/FollowedArtistReleases';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import Library from './components/Library';
import YouTubePlayer from './components/YouTubePlayer';
import Settings from './components/Settings';
import ArtistProfileModal from './components/ArtistProfileModal';
import './App.css';
import './index.css';

function AppContent() {
  const [searchResults, setSearchResults] = useState({ tracks: [], artists: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [libraryTab, setLibraryTab] = useState('liked');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [createPlaylistModalOpen, setCreatePlaylistModalOpen] = useState(false);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState(null);
  const [creationInitialTrack, setCreationInitialTrack] = useState(null);
  const [activeNavTab, setActiveNavTab] = useState('home');

  const {
    currentTrack,
    userProfile,
    followedArtists,
    selectedArtist,
    artistProfileOpen,
    openArtistProfile,
    closeArtistProfile,
    user,
  } = usePlayer();

  const openLibrary = useCallback((tab = 'index') => {
    setLibraryTab(tab);
    setActiveNavTab('library');
    setHasSearched(false);
  }, []);

  const openPlaylistModal = useCallback((track) => {
    setTrackToAddToPlaylist(track);
    setPlaylistModalOpen(true);
  }, []);

  const openCreatePlaylistModal = useCallback((track = null) => {
    setCreationInitialTrack(track);
    setCreatePlaylistModalOpen(true);
  }, []);

  const handleResults = useCallback((results) => {
    setSearchResults(results);
    const hasData = (results.tracks?.length > 0) || (results.artists?.length > 0);
    setHasSearched(hasData);
  }, []);

  const handleLoading = useCallback((loading) => {
    setIsSearching(loading);
    if (loading) setHasSearched(true);
  }, []);

  const handleError = useCallback((err) => {
    setSearchError(err);
  }, []);

  const showResults = hasSearched || (searchResults.tracks?.length > 0) || (searchResults.artists?.length > 0);

  const handleNavChange = useCallback((tab) => {
    setActiveNavTab(tab);
    if (tab === 'library') {
      openLibrary('index');
    }
    if (tab === 'search') {
      // Focus on search — scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (tab === 'home') {
      setHasSearched(false);
      setSearchResults({ tracks: [], artists: [] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [openLibrary]);

  return (
    <div className={`min-h-[100dvh] flex flex-col relative selection:bg-primary/30 selection:text-on-primary ${currentTrack ? 'has-player' : ''}`}>
      {/* Hidden YouTube player */}
      <YouTubePlayer />

      {/* Aurora Background (Layer 5) */}
      <div className="aurora-container">
        <div className="aurora-blob aurora-blob--1"></div>
        <div className="aurora-blob aurora-blob--2"></div>
        <div className="aurora-blob aurora-blob--3"></div>
      </div>

      {/* Header (Layer 100) */}
      <header className="fixed top-0 left-0 right-0 z-[100] flex justify-between items-center px-6 py-4 bg-[#0e0e0e]/70 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span 
            className="material-symbols-outlined text-white/50 hover:text-primary active:scale-95 transition-all cursor-pointer text-2xl"
            onClick={() => setSidebarOpen(true)}
          >
            menu
          </span>
          <div className="flex items-center gap-2">
            <img src="/aurevon.png" alt="Aurevon Logo" className="w-8 h-8 rounded-full border border-white/10 object-cover shadow-[0_0_15px_rgba(114,254,143,0.3)]" />
            <h1 className="text-xl font-extrabold text-white font-headline tracking-tight m-0">Aurevon</h1>
          </div>
        </div>
        <div className="active:scale-95 duration-300 cursor-pointer" onClick={() => setProfileOpen(true)}>
          {(user?.avatarUrl || userProfile?.image) ? (
            <img 
               src={user?.avatarUrl || userProfile.image} 
               alt="Profile" 
               className="w-9 h-9 rounded-full object-cover border border-white/10 shadow-lg" 
            />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 bg-white/5 text-white/40">
              <span className="material-symbols-outlined text-xl">person</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content (Layer 1) */}
      <main className="flex-1 w-full max-w-[var(--max-width)] mx-auto relative z-[var(--layer-mid)] pt-24 pb-[140px] px-5 md:px-0">
        
        {/* Global Search */}
        {activeNavTab !== 'settings' && (
          <div className="mb-8">
            <SearchBar
              onResults={handleResults}
              onLoading={handleLoading}
              onError={handleError}
              onAddToPlaylist={openPlaylistModal}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div 
              key={activeNavTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col"
            >
              {activeNavTab === 'home' && (
                <>
                  {/* Greeting + Quick Access Grid */}
                  <HomeGreeting />

                  {/* Magic Vibe AI (Hero) */}
                  <MagicVibe />

                  {/* Your Top Mixes Carousel */}
                  <TopMixes />

                  {/* Personal Library Quick Access */}
                  <QuickLibrary 
                     onOpenLibrary={openLibrary} 
                     onAddToPlaylist={openPlaylistModal}
                  />

                  {/* Favorites: New Releases */}
                  <FollowedArtistReleases 
                    followedArtists={followedArtists} 
                    onAddToPlaylist={openPlaylistModal} 
                  />

                  {/* New Releases + Trending */}
                  <NewReleases />
                </>
              )}

              {activeNavTab === 'search' && (
                <>
                  {/* Browse & Explore */}
                  <BrowseCategories />
                </>
              )}

              {activeNavTab === 'settings' && (
                <Settings />
              )}
              
              {activeNavTab === 'library' && (
                <Library 
                  initialTab={libraryTab}
                  onAddToPlaylist={openPlaylistModal}
                />
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="results"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="mt-6">
                <SearchResults
                  results={searchResults}
                  isLoading={isSearching}
                  error={searchError}
                  onAddToPlaylist={openPlaylistModal}
                  onArtistSelect={openArtistProfile}
                />
              </div>
              <div className="mt-12">
                 <Recommendations onAddToPlaylist={openPlaylistModal} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Player Bar */}
      <PlayerBar 
        onOpenLibrary={() => openLibrary('index')} 
        onAddToPlaylist={openPlaylistModal}
      />

      {/* Bottom Navigation */}
      <BottomNav 
        activeTab={activeNavTab} 
        onTabChange={handleNavChange} 
      />

      {/* Sidebars & Modals */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onSelectTab={openLibrary} 
        onOpenCreatePlaylist={() => openCreatePlaylistModal(null)}
      />
      <ProfileModal 
        isOpen={profileOpen} 
        onClose={() => setProfileOpen(false)} 
        onOpenSettings={() => handleNavChange('settings')}
        onArtistSelect={openArtistProfile}
      />
      <AddToPlaylistModal 
        isOpen={playlistModalOpen} 
        onClose={() => setPlaylistModalOpen(false)} 
        track={trackToAddToPlaylist}
        onOpenCreatePlaylist={openCreatePlaylistModal}
      />
      <CreatePlaylistModal 
        isOpen={createPlaylistModalOpen} 
        onClose={() => setCreatePlaylistModalOpen(false)} 
        initialTrack={creationInitialTrack}
      />
      {selectedArtist && (
        <ArtistProfileModal 
          artist={selectedArtist} 
          isOpen={artistProfileOpen} 
          onClose={closeArtistProfile} 
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
