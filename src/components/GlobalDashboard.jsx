import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API } from '../config/api';
import TrackCard from './TrackCard';
import './GlobalDashboard.css';

const MOODS = [
  { id: 'all', name: 'All Vibes', icon: 'auto_awesome' },
  { id: 'sigma', name: 'Sigma Grind', icon: 'fitness_center' },
  { id: 'late-night', name: 'Late Night', icon: 'dark_mode' },
  { id: 'heartbreak', name: 'Heartbreak', icon: 'heart_broken' },
  { id: 'soft-life', name: 'Soft Life', icon: 'spa' },
  { id: 'party-mode', name: 'Party Mode', icon: 'celebration' },
  { id: 'villain-arc', name: 'Villain Arc', icon: 'bolt' },
  { id: 'toxic', name: 'Toxic', icon: 'electric_bolt' }
];

const LANGUAGES = [
  { id: 'all', name: 'Worldwide' },
  { id: 'English', name: 'English' },
  { id: 'Spanish', name: 'Spanish' },
  { id: 'K-Pop', name: 'K-Pop' },
  { id: 'J-Pop', name: 'J-Pop' },
  { id: 'Indian', name: 'Bollywood' },
  { id: 'Russian', name: 'Russian' },
  { id: 'Portuguese', name: 'Portuguese' },
  { id: 'French', name: 'French' }
];

export default function GlobalDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMood, setActiveMood] = useState('all');
  const [activeLang, setActiveLang] = useState('all');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API('/itunes/global-dashboard'));
      if (!response.ok) throw new Error('Failed to fetch global charts');
      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error('[Dashboard] Fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTracks = useMemo(() => {
    if (!data?.allTracks) return [];
    
    return data.allTracks
      .filter(track => {
        const moodMatch = activeMood === 'all' || track.vibe === activeMood;
        const langMatch = activeLang === 'all' || track.languages.includes(activeLang);
        return moodMatch && langMatch;
      })
      .sort((a, b) => a.maxRank - b.maxRank);
  }, [data, activeMood, activeLang]);

  const trendingTracks = useMemo(() => {
    if (!data?.trending) return [];
    return data.trending;
  }, [data]);

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner--large" />
        <p className="text-primary font-bold animate-pulse uppercase tracking-[2px]">Fetching Global Vibes...</p>
        <div className="flex gap-4">
          <div className="skeleton-card w-[300px]" />
          <div className="skeleton-card w-[300px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <span className="material-symbols-outlined text-error text-6xl mb-4">cloud_off</span>
        <h2 className="text-2xl font-bold mb-2">Connection Refused</h2>
        <p className="text-text-muted mb-6"> {error} </p>
        <button className="btn-primary" onClick={fetchDashboard}>Retry Connection</button>
      </div>
    );
  }

  return (
    <div className="global-dashboard">
      {/* Hero Section */}
      <motion.div 
        className="global-hero"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <img src="/assets/global_genz_hits.png" alt="Global GenZ Hits" className="global-hero__image" />
        <div className="global-hero__overlay" />
        <div className="global-hero__content">
          <div className="global-hero__badge">Global Trending</div>
          <h1 className="global-hero__title">Gen Z Global Charts</h1>
          <p className="global-hero__subtitle">The ultimate music culture platform for global discovery.</p>
        </div>
      </motion.div>

      {/* Interactive Filters */}
      <div className="global-filters">
        <div className="filter-group">
          {LANGUAGES.map(lang => (
            <button 
              key={lang.id}
              className={`filter-btn ${activeLang === lang.id ? 'filter-btn--active' : ''}`}
              onClick={() => setActiveLang(lang.id)}
            >
              {lang.name}
            </button>
          ))}
        </div>
        <div className="filter-group">
          {MOODS.map(mood => (
            <button 
              key={mood.id}
              className={`filter-btn ${activeMood === mood.id ? 'filter-btn--active' : ''}`}
              onClick={() => setActiveMood(mood.id)}
            >
              <span className="material-symbols-outlined text-[14px] mr-2">{mood.icon}</span>
              {mood.name}
            </button>
          ))}
        </div>
      </div>

      {/* Viral Hits Section */}
      {activeMood === 'all' && activeLang === 'all' && (
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <div>
              <h2 className="dashboard-section__title">🔥 Global Viral Hits</h2>
              <p className="dashboard-section__subtitle">Most trending international songs overall</p>
            </div>
          </div>
          <div className="dashboard-grid">
            {trendingTracks.map((track, i) => (
              <TrackCard key={track.id} track={{ ...track, rank: i + 1 }} />
            ))}
          </div>
        </section>
      )}

      {/* Main Results Grid */}
      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <h2 className="dashboard-section__title">
              {activeMood !== 'all' ? `${MOODS.find(m => m.id === activeMood)?.name} Tunes` : 'Discovery Feed'}
            </h2>
            <p className="dashboard-section__subtitle">
              {filteredTracks.length} tracks found matching your vibe
            </p>
          </div>
        </div>
        
        <AnimatePresence mode="popLayout">
          <motion.div 
            className="dashboard-grid"
            layout
          >
            {filteredTracks.map((track, i) => (
              <motion.div
                key={track.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <TrackCard track={{ ...track, rank: track.maxRank }} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}
