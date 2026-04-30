import { useEffect, useRef, memo } from 'react';
import usePlayer from '../hooks/usePlayer';

const YouTubePlayer = memo(function YouTubePlayer() {
  const { videoId, currentTime, setPlayerRef, onTrackEnd, setPlayerReady, setUserInteracted, volume, setPlaying } =
    usePlayer();
  const containerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const isInitializedRef = useRef(false);
  const onTrackEndRef = useRef(onTrackEnd);
  // Using refs for initial sync values to avoid stale closures in the 1-time initPlayer effect
  const initialVideoIdRef = useRef(videoId);
  const initialTimeRef = useRef(currentTime);

  // Update initial refs so that onReady gets the latest videoId if it was changed before player initialized (like via shared links)
  useEffect(() => {
    initialVideoIdRef.current = videoId;
  }, [videoId]);

  useEffect(() => {
    initialTimeRef.current = currentTime;
  }, [currentTime]);

  // Keep callback ref current without re-creating player
  useEffect(() => {
    onTrackEndRef.current = onTrackEnd;
  }, [onTrackEnd]);

  useEffect(() => {
    if (isInitializedRef.current) return;

    const loadAPI = () => {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          resolve();
          return;
        }
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScript = document.getElementsByTagName('script')[0];
        firstScript.parentNode.insertBefore(tag, firstScript);
        window.onYouTubeIframeAPIReady = resolve;
      });
    };

    const initPlayer = async () => {
      await loadAPI();
      if (isInitializedRef.current) return;
      isInitializedRef.current = true;

      playerInstanceRef.current = new window.YT.Player(containerRef.current, {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0, // Control manually based on session state
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            setPlayerRef(event.target);
            setPlayerReady();
            event.target.setVolume(volume);
            
            // Session Resumption Logic using the values captured at mount
            if (initialVideoIdRef.current) {
              const isSharedSong = window.__aurevonSharedSong === true;
              
              if (isSharedSong) {
                // If it's a shared link, attempt to play automatically
                event.target.loadVideoById({
                  videoId: initialVideoIdRef.current,
                  startSeconds: 0
                });
                setPlaying(true);
              } else {
                // 'Cue' ensures we don't violate autoplay policies on page load
                event.target.cueVideoById({
                  videoId: initialVideoIdRef.current,
                  startSeconds: initialTimeRef.current || 0
                });
              }
            }
          },
          onStateChange: (event) => {
            const state = event.data;
            
            // Handle End of Track
            if (state === window.YT.PlayerState.ENDED) {
              onTrackEndRef.current();
              return;
            }

            // Sync global playing state with YouTube's internal state
            if (state === window.YT.PlayerState.PLAYING) {
              setUserInteracted();
              setPlaying(true);
            } else if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.BUFFERING) {
              // We keep it 'true' during buffering to show active UI, but false on explicit pause
              setPlaying(state === window.YT.PlayerState.BUFFERING || state === window.YT.PlayerState.PLAYING);
            } else if (state === window.YT.PlayerState.CUED) {
              setPlaying(false);
            }
          },
          onError: (event) => {
            const errorCodes = {
                2: 'Invalid parameter',
                5: 'HTML5 player error',
                100: 'Video not found/removed',
                101: 'Embedded playback restricted',
                150: 'Embedded playback restricted'
            };
            console.error(`[Aurevon Player] Error ${event.data}: ${errorCodes[event.data] || 'Unknown error'}`);
            
            // Embedded playback restrictions should not force a 0-second skip loop.
            if ([101, 150].includes(event.data)) {
                setPlaying(false);
                console.warn('[Aurevon Player] Embedded playback is restricted for this track. Staying on the current item.');
                return;
            }

            if (event.data === 100) {
                console.warn('[Aurevon Player] Auto-skipping unavailable content...');
                onTrackEndRef.current();
            }
          },
        },
      });
    };

    initPlayer();

    return () => {
      // Don't destroy on unmount — player persists
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div ref={containerRef} id="youtube-player" />
    </div>
  );
});

export default YouTubePlayer;
