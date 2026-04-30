import { useState, useCallback, useEffect } from 'react';
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
import JammingHub from './components/Jamming/JammingHub';
import WrappedDashboard from './components/Wrapped/WrappedDashboard';
import { JamProvider } from './context/JamContext';
import ResumeSessionOverlay from './components/ResumeSessionOverlay';
import AdminPanel from './components/AdminPanel';
import GlobalDashboard from './components/GlobalDashboard';
import { getTrackById } from './services/spotifyService';
import './App.css';
import './index.css';

function AppContent() {
  const [searchResults, setSearchResults] = useState({ tracks: [], artists: [] });
  
  // Theme initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('wavify_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);
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
    playTrack,
  } = usePlayer();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const songId = params.get('song');
    if (songId) {
      // Clear the param so it doesn't trigger on reload
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const playSharedSong = async () => {
        try {
          const track = await getTrackById(songId);
          if (track) {
            playTrack(track);
          }
        } catch (e) {
          console.error("Failed to load shared song", e);
        }
      };
      playSharedSong();
    }
  }, [playTrack]);

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
    if (tab === 'admin' || tab === 'settings' || tab === 'jamming' || tab === 'wrapped') {
      setHasSearched(false);
      setSearchResults({ tracks: [], artists: [] });
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
    if (tab === 'jamming' || tab === 'wrapped' || tab === 'admin' || tab === 'global-dashboard' || tab === 'library' || tab === 'settings') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [openLibrary]);

  return (
    <div className={`min-h-[100dvh] flex flex-col relative selection:bg-primary/30 selection:text-on-primary ${currentTrack ? 'has-player' : ''}`}>
      {/* Session Resume UI */}
      <ResumeSessionOverlay />

      {/* Hidden YouTube player */}
      <YouTubePlayer />

      {/* Aurora Background (Layer 5) */}
      <div className="aurora-container">
        <div className="aurora-blob aurora-blob--1"></div>
        <div className="aurora-blob aurora-blob--2"></div>
        <div className="aurora-blob aurora-blob--3"></div>
      </div>

      {/* Header (Layer 100) */}
      <header className="fixed top-0 left-0 right-0 z-[100] flex justify-between items-center px-4 py-4 bg-glass backdrop-blur-2xl border-b border-glass-bright">
        <div className="flex items-center gap-3 px-4">
          <span 
            className="material-symbols-outlined text-secondary hover:text-primary active:scale-95 transition-all cursor-pointer text-2xl"
            onClick={() => setSidebarOpen(true)}
          >
            menu
          </span>
          <div className="flex items-center gap-2">
            <img src="/aurevon.png" alt="Aurevon Logo" className="w-8 h-8 rounded-full border border-glass object-cover shadow-glow" />
            <h1 className="text-xl font-extrabold text-primary font-headline tracking-tight m-0">Aurevon</h1>
          </div>
        </div>
        <div 
          className="relative group active:scale-90 duration-300 cursor-pointer p-0.5 rounded-full overflow-hidden" 
          onClick={() => setProfileOpen(true)}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-tertiary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          {(user?.avatarUrl || userProfile?.image) ? (
            <img 
               src={user?.avatarUrl || userProfile?.image} 
               alt="Profile" 
               className="w-8 h-8 rounded-full object-cover border border-glass shadow-sm relative z-10" 
            />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center border border-glass bg-surface-container text-secondary relative z-10">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content (Layer 1) */}
      <main className={`flex-1 w-full max-w-[var(--max-width)] mx-auto relative z-[var(--layer-mid)] pt-24 px-0 md:px-0 ${currentTrack ? 'pb-[220px]' : 'pb-[140px]'}`}>
        
        {/* Global Search */}
        {activeNavTab !== 'settings' && activeNavTab !== 'admin' && activeNavTab !== 'jamming' && activeNavTab !== 'wrapped' && activeNavTab !== 'global-dashboard' && (
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
                  <BrowseCategories onTabChange={handleNavChange} />
                </>
              )}

              {activeNavTab === 'settings' && (
                <Settings />
              )}
              
              {activeNavTab === 'jamming' && (
                <JammingHub />
              )}

              {activeNavTab === 'wrapped' && (
                <WrappedDashboard onClose={() => handleNavChange('home')} />
              )}

              {activeNavTab === 'admin' && (
                <AdminPanel />
              )}

              {activeNavTab === 'global-dashboard' && (
                <GlobalDashboard />
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
        onSelectTab={(tab) => {
          if (['admin', 'settings', 'jamming', 'wrapped', 'global-dashboard', 'home', 'search'].includes(tab)) {
            handleNavChange(tab);
          } else {
            openLibrary(tab);
          }
        }} 
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
      <JamProvider>
        <AppContent />
      </JamProvider>
    </PlayerProvider>
  );
}
