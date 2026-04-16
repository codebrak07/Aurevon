import { useState, useEffect, memo } from 'react';
import usePlayer from '../hooks/usePlayer';
import './LyricsViewer.css';

 // Parses LRC format with offset support and improved regex
function parseLrc(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const result = [];
  let offset = 0; // global offset in ms

  // 1. Try to find [offset: +/-ms] tag
  const offsetMatch = text.match(/\[offset\s*:\s*(-?\d+)\]/i);
  if (offsetMatch) {
    offset = parseInt(offsetMatch[1], 10) / 1000; // convert to seconds
  }
  
  // regex for [mm:ss.ms] or [mm:ss:ms]
  const timeRegex = /\[(\d+):(\d+)(?:[:\.](\d+))?\]/g;

  for (const line of lines) {
    timeRegex.lastIndex = 0;
    const match = timeRegex.exec(line);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msPart = match[3] || '0';
      
      // Handle cases where ms might be 1, 2 or 3 digits (e.g. .5, .50, .500)
      const fractionalSec = parseInt(msPart, 10) / (Math.pow(10, msPart.length));
      
      // Apply offset (LRC offset is added to timestamps)
      const time = (min * 60 + sec + fractionalSec) + offset;
      const content = line.replace(timeRegex, '').trim();
      
      if (content && content.length > 1) {
        result.push({ time, content });
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

// Generates a consistent solid color array based on string hash
function getThemeColor(str) {
  if (!str) return '#3b82f6';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#f59e0b', // Yellow/Amber
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f97316', // Orange
  ];
  return colors[Math.abs(hash) % colors.length];
}

// Registry for tracks that need high-precision hardcoded lyrics
const HARDCODED_LYRICS = {
  'Ravyn Lenae - Love Me Not': `[00:16.55] See, right now, I need you, I'll meet you somewhere now
[00:21.14] You up now, I see you, I get you, take care now
[00:25.29] Slow down, be cool, I miss you, come here now
[00:29.44] It's yours now, keep it, I'll hold out, until now
[00:33.61] I need you right now, once I leave you I'm strung out
[00:37.79] If I get you, I'm slowly breaking down
[00:41.85] And, oh, it's hard to see you, but I wish you were right here
[00:46.12] Oh, it hard to leave you when I get you everywhere
[00:50.42] All this time I'm thinking, I'm strong enough to sink in
[00:54.54] Oh, no, I don't need you, but I miss you, come here
[00:58.98] He love me not, he loves me, he holds me tight, then lets me go
[01:03.34] He love me not, he loves me, he holds me tight, then lets me go
[01:07.78] Well, it's safe to say now, you can tell I miss you the most
[01:12.05] I step away now, it'll make it harder, I know
[01:16.34] Whether this is right or whether we should do this at all
[01:20.49] I don't know either way all I know is that we've been moving on
[01:23.89] There's a lot in our minds, we've been acting kinda crazy
[01:28.55] We know how to push each other 'til we go insane
[01:32.44] So we probably shouldn't do this, we already went through this
[01:36.91] But I know if I'm not with you then I'ma miss ya, yeah, yeah
[01:40.93] And, oh, it's hard to see you, but I wish you were right here
[01:45.16] Oh, it's hard to leave you when I get you everywhere
[01:49.45] All this time I'm thinking we could never be a pair
[01:53.65] Oh, no, I don't need you, but I miss you, come here
[01:57.70] And, oh, it's hard to see you, but I wish you were right here
[02:02.16] Oh, it's hard to leave you when I get you everywhere
[02:06.30] All this time, I'm thinking I'm strong enough to sink in
[02:10.39] Oh, no, I don't need you, but I miss you, come here
[02:14.76] He love me not, he loves me, he holds me tight, then lets me go
[02:18.99] He love me not, he loves me, he holds me tight, then lets me go
[02:23.57] You're gonna say that you're sorry at the end of the night
[02:28.32] Wake up in the morning, everything's alright
[02:32.22] At the end of the story, you're holding me tight
[02:36.87] I don't need to worry, am I out of my mind?
[02:39.66] And, oh, it's hard to see you, but I wish you were right here (I'm losing my mind)
[02:44.34] Oh, it's hard to leave you when I get you everywhere
[02:48.36] All this time, I'm thinking I'm strong enough to sink in
[02:52.41] Oh, no, I don't need you, but I miss you, come here`
};

const LyricsViewer = memo(function LyricsViewer() {
  const { currentTrack, currentTime } = usePlayer();
  const [lyrics, setLyrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;
    
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLyrics([]);

    async function fetchLyrics() {
      try {
        // Priority 1: Check for hardcoded high-precision lyrics
        const trackKey = `${currentTrack.artist} - ${currentTrack.title}`;
        if (HARDCODED_LYRICS[trackKey]) {
          const parsed = parseLrc(HARDCODED_LYRICS[trackKey]);
          setLyrics(parsed);
          setLoading(false);
          return;
        }

        const queryParams = {
          artist_name: currentTrack.artist,
          track_name: currentTrack.title,
        };

        // If we have album and duration, it helps LRCLIB narrow down to 100% accuracy
        if (currentTrack.album) queryParams.album_name = currentTrack.album;
        if (currentTrack.duration) queryParams.duration = Math.round(currentTrack.duration / 1000);

        const params = new URLSearchParams(queryParams);
        const res = await fetch(`https://lrclib.net/api/get?${params}`);
        if (!res.ok) throw new Error('Lyrics not found');
        
        const data = await res.json();
        if (cancelled) return;

        if (data.syncedLyrics) {
          const parsed = parseLrc(data.syncedLyrics);
          if (parsed.length > 0) {
            setLyrics(parsed);
          } else {
            setError('No synced lyrics available.');
          }
        } else if (data.plainLyrics) {
          // Fallback to plain lyrics if synced ones are missing
          const plainLines = data.plainLyrics.split('\n').filter(l => l.trim().length > 0);
          setLyrics(plainLines.map((l, i) => ({ time: i * 5, content: l.trim() }))); // Rough estimation
        } else {
          setError('No lyrics found.');
        }
      } catch (err) {
        if (!cancelled) setError("Could not load lyrics. They might not be available.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLyrics();

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id]); // eslint-disable-line

  // Handle YouTube player reporting latency (usually 300-500ms)
  const SYNC_CORRECTION = 0.3; 
  const adjustedTime = currentTime + SYNC_CORRECTION;

  // Find the active line logic
  let activeIndex = -1;
  if (lyrics.length > 0) {
    for (let i = 0; i < lyrics.length; i++) {
      if (adjustedTime >= lyrics[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  const bgColor = getThemeColor(currentTrack?.title);

  // Status Displays logic (Loading/Error)
  if (loading || error || (lyrics.length === 0 && !loading)) {
    let message = 'Searching for lyrics...';
    if (loading) message = 'Searching...';
    if (error) message = error;

    return (
      <div className="now-playing__artwork-stage">
        <div className="lyrics-box" style={{ backgroundColor: bgColor }}>
           {currentTrack?.albumArt && (
             <div 
               className="lyrics-box__background" 
               style={{ backgroundImage: `url(${currentTrack.albumArt})` }}
             />
           )}
           <div className="lyrics-box__overlay" />
           <div className="lyrics-box__content">
             <span className="lyrics-box__info" style={{ color: 'white' }}>{message}</span>
           </div>
        </div>
      </div>
    );
  }

  const activeLine = activeIndex !== -1 ? lyrics[activeIndex].content : '...';
  // Words array for the word-by-word fade animation
  const words = activeLine.split(' ').map((word, i) => ({
    id: `${activeIndex}-${i}-${word}`, // unique key to force re-render/animation reset
    text: word,
    delay: `${i * 0.08}s` // staggering delay
  }));

  return (
    <div className="now-playing__artwork-stage">
      <div className="lyrics-box" style={{ backgroundColor: bgColor }}>
        {/* Dynamic Blurred Background */}
        {currentTrack?.albumArt && (
          <div 
            className="lyrics-box__background" 
            style={{ backgroundImage: `url(${currentTrack.albumArt})` }}
          />
        )}
        
        {/* Darkened overlay for readability */}
        <div className="lyrics-box__overlay" />

        <div className="lyrics-box__content" key={activeIndex}>
          {words.map((w) => (
            <span 
              key={w.id} 
              className="lyrics-word"
              style={{ 
                animationDelay: w.delay,
                color: bgColor // Apply adaptive color to text
              }}
            >
              {w.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

export default LyricsViewer;

