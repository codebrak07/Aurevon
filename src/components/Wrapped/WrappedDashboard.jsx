import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import usePlayer from '../../hooks/usePlayer';
import AurevonMoments from '../AurevonMoments';
import './WrappedDashboard.css';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short' });
const FULL_MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long' });

function toHistoryEntries(listeningHistory, recentTracks, recentlyPlayed, likedSongs) {
  if (listeningHistory.length > 0) {
    return listeningHistory.filter((entry) => entry?.track?.title && entry?.ts);
  }

  if (recentTracks.length > 0) {
    return recentTracks.map((track, index) => ({
      track,
      label: 'recent_pick',
      isLiked: likedSongs.some((song) => song.id === track.id),
      percentListened: 1,
      ts: Date.now() - (index * 86400000),
    }));
  }

  if (recentlyPlayed.length > 0) {
    return recentlyPlayed
      .filter((track) => track?.title)
      .map((track, index) => ({
        track,
        label: 'recent_pick',
        isLiked: likedSongs.some((song) => song.id === track.id),
        percentListened: 1,
        ts: track.playedAt || (Date.now() - (index * 86400000)),
      }));
  }

  return likedSongs
    .filter((track) => track?.title)
    .map((track, index) => ({
      track,
      label: 'liked_seed',
      isLiked: true,
      percentListened: 1,
      ts: Date.now() - (index * 86400000),
    }));
}

function estimateMinutes(entry) {
  const labelWeights = {
    looped: 6.5,
    listened_fully: 4.2,
    recent_pick: 3.5,
    liked_seed: 3.2,
    neutral: 2.8,
    skipped_early: 1.1,
  };

  const weight = labelWeights[entry.label] ?? 2.5;
  const percent = typeof entry.percentListened === 'number' ? Math.max(entry.percentListened, 0.15) : 1;
  return weight * percent;
}

function buildWrappedStats(entries, likedSongs, followedArtists) {
  const trackMap = new Map();
  const artistMap = new Map();
  const monthMap = new Map();
  const hourMap = new Map();
  const genreMap = new Map();
  const vibeMap = new Map();

  let totalMinutes = 0;
  let totalLikedMoments = 0;
  let skipCount = 0;

  entries.forEach((entry) => {
    const { track } = entry;
    const playedAt = new Date(entry.ts || Date.now());
    const monthKey = `${playedAt.getFullYear()}-${playedAt.getMonth()}`;
    const hour = playedAt.getHours();
    const title = track?.title || 'Unknown Track';
    const artist = track?.artist || 'Unknown Artist';
    const genre = track?.genre || track?.album || 'Genre-fluid';
    const vibe = inferVibe(entry, hour, genre);
    const estimatedMinutes = estimateMinutes(entry);

    totalMinutes += estimatedMinutes;
    if (entry.isLiked) totalLikedMoments += 1;
    if (entry.label === 'skipped_early') skipCount += 1;

    const trackKey = track?.id || `${title}-${artist}`;
    trackMap.set(trackKey, {
      key: trackKey,
      title,
      artist,
      plays: (trackMap.get(trackKey)?.plays || 0) + 1,
      minutes: (trackMap.get(trackKey)?.minutes || 0) + estimatedMinutes,
      art: track?.albumArt || track?.albumArtSmall || track?.thumbnail || null,
    });

    artistMap.set(artist, {
      name: artist,
      plays: (artistMap.get(artist)?.plays || 0) + 1,
    });

    genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
    vibeMap.set(vibe, (vibeMap.get(vibe) || 0) + 1);
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);

    const monthEntry = monthMap.get(monthKey) || {
      key: monthKey,
      date: new Date(playedAt.getFullYear(), playedAt.getMonth(), 1),
      plays: 0,
      minutes: 0,
      topTrackCounts: new Map(),
    };

    monthEntry.plays += 1;
    monthEntry.minutes += estimatedMinutes;
    monthEntry.topTrackCounts.set(trackKey, {
      title,
      artist,
      plays: (monthEntry.topTrackCounts.get(trackKey)?.plays || 0) + 1,
    });
    monthMap.set(monthKey, monthEntry);
  });

  const sortedTracks = [...trackMap.values()].sort((a, b) => b.plays - a.plays || b.minutes - a.minutes);
  const sortedArtists = [...artistMap.values()].sort((a, b) => b.plays - a.plays);
  const sortedGenres = [...genreMap.entries()].sort((a, b) => b[1] - a[1]);
  const sortedVibes = [...vibeMap.entries()].sort((a, b) => b[1] - a[1]);
  const sortedMonths = [...monthMap.values()]
    .sort((a, b) => a.date - b.date)
    .map((month) => {
      const topTrack = [...month.topTrackCounts.values()].sort((a, b) => b.plays - a.plays)[0];
      return {
        label: MONTH_FORMATTER.format(month.date),
        fullLabel: FULL_MONTH_FORMATTER.format(month.date),
        plays: month.plays,
        minutes: Math.round(month.minutes),
        topTrack,
      };
    });

  const busiestMonth = [...sortedMonths].sort((a, b) => b.plays - a.plays)[0] || null;
  const peakHour = [...hourMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const peakWindow = describeHour(peakHour);
  const topTrack = sortedTracks[0] || null;
  const topArtist = sortedArtists[0] || null;
  const topGenre = sortedGenres[0]?.[0] || 'Genre-fluid';
  const topVibe = sortedVibes[0]?.[0] || 'Late Night Drift';
  const replayScore = topTrack ? Math.min(100, Math.round((topTrack.plays / Math.max(entries.length, 1)) * 220)) : 0;

  return {
    totalMoments: entries.length,
    totalMinutes: Math.round(totalMinutes),
    topTrack,
    topArtist,
    topTracks: sortedTracks.slice(0, 5),
    topArtists: sortedArtists.slice(0, 5),
    topGenre,
    topVibe,
    busiestMonth,
    peakWindow,
    replayScore,
    likedMoments: totalLikedMoments,
    followedArtistsCount: followedArtists.length,
    likedSongsCount: likedSongs.length,
    skipRate: entries.length ? Math.round((skipCount / entries.length) * 100) : 0,
    monthlyBreakdown: sortedMonths.slice(-6),
    topGenres: sortedGenres.slice(0, 3).map(([name, count]) => ({ name, count })),
    vibeBreakdown: sortedVibes.slice(0, 3).map(([name, count]) => ({ name, count })),
  };
}

function inferVibe(entry, hour, genre) {
  const loweredGenre = String(genre || '').toLowerCase();

  if (entry.label === 'looped') return 'Replay Spiral';
  if (entry.label === 'skipped_early') return 'Restless Switch-Up';
  if (hour >= 0 && hour < 5) return 'Midnight Drift';
  if (loweredGenre.includes('lofi') || loweredGenre.includes('chill')) return 'Soft Focus';
  if (loweredGenre.includes('dance') || loweredGenre.includes('house') || loweredGenre.includes('pop')) return 'Main Character Glow';
  if (loweredGenre.includes('rock') || loweredGenre.includes('metal')) return 'Adrenaline Rush';
  if (loweredGenre.includes('jazz') || loweredGenre.includes('soul')) return 'Velvet After Dark';
  return 'Mood Mosaic';
}

function describeHour(hour) {
  if (typeof hour !== 'number') return 'Anytime';
  if (hour < 5) return 'After midnight';
  if (hour < 12) return 'Morning boost';
  if (hour < 18) return 'Afternoon cruise';
  if (hour < 22) return 'Evening reset';
  return 'Late-night session';
}

export default function WrappedDashboard({ onClose }) {
  const { listeningHistory, recentTracks, recentlyPlayed, likedSongs, followedArtists, userProfile } = usePlayer();
  const entries = toHistoryEntries(listeningHistory, recentTracks, recentlyPlayed, likedSongs);
  const stats = buildWrappedStats(entries, likedSongs, followedArtists);
  const hasData = entries.length > 0;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const SLIDE_DURATION = 6000;
  const totalSlides = 6;

  useEffect(() => {
    if (!hasData || isPaused) return;

    let start = Date.now() - (progress / 100) * SLIDE_DURATION;
    let animationFrame;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - start;
      const newProgress = (elapsed / SLIDE_DURATION) * 100;

      if (newProgress >= 100) {
        if (currentSlide < totalSlides - 1) {
          setCurrentSlide(prev => prev + 1);
          setProgress(0);
        } else {
          setProgress(100);
        }
      } else {
        setProgress(newProgress);
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [currentSlide, hasData, isPaused, progress]);

  // Reset progress when slide changes manually
  useEffect(() => {
    setProgress(0);
  }, [currentSlide]);

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handlePointerDown = () => setIsPaused(true);
  const handlePointerUp = () => setIsPaused(false);

  if (!hasData) {
    return (
      <div className="wrapped-dashboard empty">
        <div className="wrapped-shell">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="wrapped-empty"
          >
            <div className="wrapped-empty__orb" />
            <h1>Wrapped is waiting for your soundtrack.</h1>
            <p>Play a few songs and Aurevon will start building your monthly peaks, favorite loops, and overall vibe story.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  const renderSlide = () => {
    switch(currentSlide) {
      case 0:
        return (
          <motion.div key="slide-0" className="wrapped-slide slide-intro" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 1.05 }} 
            transition={{ duration: 0.5 }}>
            <motion.p className="wrapped-kicker" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>Aurevon Wrapped</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              {userProfile?.name || userProfile?.fullName || 'Your'} listening era, decoded.
            </motion.h1>
            <motion.div className="intro-shapes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
               <div className="shape shape-1"></div>
               <div className="shape shape-2"></div>
            </motion.div>
          </motion.div>
        );
      case 1:
        return (
          <motion.div key="slide-1" className="wrapped-slide slide-minutes" 
            initial={{ opacity: 0, x: 50 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -50 }} 
            transition={{ duration: 0.5 }}>
             <p className="slide-eyebrow">You lived in the music.</p>
             <motion.div className="big-number" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}>
                {stats.totalMinutes.toLocaleString()}
             </motion.div>
             <p className="slide-meta-large">minutes listened.</p>
          </motion.div>
        );
      case 2:
        return (
          <motion.div key="slide-2" className="wrapped-slide slide-track" 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -50 }} 
            transition={{ duration: 0.5 }}>
             <p className="slide-eyebrow">Your top song was</p>
             {stats.topTrack?.art && (
               <motion.img src={stats.topTrack.art} alt="Album Art" className="wrapped-track-art" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} />
             )}
             <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>{stats.topTrack?.title}</motion.h2>
             <motion.p className="slide-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>by {stats.topTrack?.artist}</motion.p>
             <motion.div className="slide-plays" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>{stats.topTrack?.plays || 0} plays</motion.div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div key="slide-3" className="wrapped-slide slide-artist" 
            initial={{ opacity: 0, scale: 1.1 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }} 
            transition={{ duration: 0.5 }}>
             <p className="slide-eyebrow">You couldn't get enough of</p>
             <motion.h2 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>{stats.topArtist?.name}</motion.h2>
             <motion.p className="slide-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>{stats.topArtist?.plays || 0} sessions with them.</motion.p>
          </motion.div>
        );
      case 4:
        return (
          <motion.div key="slide-4" className="wrapped-slide slide-vibe" 
            initial={{ opacity: 0, rotate: -5 }} 
            animate={{ opacity: 1, rotate: 0 }} 
            exit={{ opacity: 0, rotate: 5 }} 
            transition={{ duration: 0.5 }}>
             <p className="slide-eyebrow">Your sonic aesthetic</p>
             <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>{stats.topVibe}</motion.h2>
             <motion.p className="slide-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>You mostly listened during: <strong>{stats.peakWindow}</strong></motion.p>
          </motion.div>
        );
      case 5:
        return (
          <motion.div key="slide-5" className="wrapped-slide slide-summary" 
            initial={{ opacity: 0, y: 100 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.7, type: 'spring' }}>
             <h2>Aurevon Wrapped</h2>
             <div className="summary-grid">
               <div className="summary-col">
                 <h3>Top Artists</h3>
                 <ol>
                    {stats.topArtists.map((artist, i) => (
                      <li key={i}>{artist.name}</li>
                    ))}
                 </ol>
               </div>
               <div className="summary-col">
                 <h3>Top Songs</h3>
                 <ol>
                    {stats.topTracks.map((track, i) => (
                      <li key={i}>{track.title}</li>
                    ))}
                 </ol>
               </div>
             </div>
             <div className="summary-footer">
                <div className="summary-stat">
                   <h4>Minutes Listened</h4>
                   <p>{stats.totalMinutes.toLocaleString()}</p>
                </div>
                <div className="summary-stat">
                   <h4>Top Genre</h4>
                   <p>{stats.topGenre}</p>
                </div>
             </div>
             <div className="mt-6 text-left">
                <AurevonMoments />
             </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="wrapped-story-container">
      {/* Background layer */}
      <div className={`wrapped-story-bg slide-${currentSlide}-bg`} />

      {/* Close button */}
      {onClose && (
        <button className="wrapped-story-close" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      )}

      {/* Progress Bars */}
      <div className="wrapped-story-bars">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div key={i} className="story-bar">
            <div 
              className="story-bar-fill" 
              style={{ 
                width: i < currentSlide ? '100%' : i === currentSlide ? `${progress}%` : '0%' 
              }} 
            />
          </div>
        ))}
      </div>
      
      {/* Click zones */}
      <div className="wrapped-story-click-zones">
        <div className="zone-prev" onClick={handlePrev} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
        <div className="zone-next" onClick={handleNext} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
      </div>

      {/* Slide Content */}
      <div className="wrapped-story-content">
        <AnimatePresence mode="wait">
          {renderSlide()}
        </AnimatePresence>
      </div>
    </div>
  );
}
