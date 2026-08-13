import { useEffect, useRef, memo } from 'react';
import usePlayer from '../hooks/usePlayer';

const YouTubePlayer = memo(function YouTubePlayer() {
  const {
    videoId,
    currentTime,
    setPlayerRef,
    setPrebufferPlayerRef,
    onTrackEnd,
    setPlayerReady,
    setUserInteracted,
    volume,
    setPlaying
  } = usePlayer();

  const containerRef = useRef(null);
  const prebufferContainerRef = useRef(null);
  const primaryPlayerRef = useRef(null);
  const secondaryPlayerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const onTrackEndRef = useRef(onTrackEnd);
  
  const initialVideoIdRef = useRef(videoId);
  const initialTimeRef = useRef(currentTime);

  useEffect(() => {
    initialVideoIdRef.current = videoId;
  }, [videoId]);

  useEffect(() => {
    initialTimeRef.current = currentTime;
  }, [currentTime]);

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

    const commonPlayerVars = {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      playsinline: 1,
      origin: window.location.origin,
    };

    const initPlayer = async () => {
      await loadAPI();
      if (isInitializedRef.current) return;
      isInitializedRef.current = true;

      // Initialize Primary Player
      primaryPlayerRef.current = new window.YT.Player(containerRef.current, {
        height: '0',
        width: '0',
        playerVars: commonPlayerVars,
        events: {
          onReady: (event) => {
            setPlayerRef(event.target);
            setPlayerReady();
            event.target.setVolume(volume);

            if (initialVideoIdRef.current) {
              const isSharedSong = window.__aurevonSharedSong === true;
              if (isSharedSong) {
                event.target.loadVideoById({
                  videoId: initialVideoIdRef.current,
                  startSeconds: 0
                });
                setPlaying(true);
              } else {
                event.target.cueVideoById({
                  videoId: initialVideoIdRef.current,
                  startSeconds: initialTimeRef.current || 0
                });
              }
            }
          },
          onStateChange: (event) => {
            const state = event.data;
            if (state === window.YT.PlayerState.ENDED) {
              onTrackEndRef.current();
              return;
            }
            if (state === window.YT.PlayerState.PLAYING) {
              setUserInteracted();
              setPlaying(true);
            } else if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.BUFFERING) {
              setPlaying(state === window.YT.PlayerState.BUFFERING || state === window.YT.PlayerState.PLAYING);
            } else if (state === window.YT.PlayerState.CUED) {
              setPlaying(false);
            }
          },
          onError: (event) => {
            if ([101, 150].includes(event.data)) {
              setPlaying(false);
              return;
            }
            if (event.data === 100) {
              onTrackEndRef.current();
            }
          },
        },
      });

      // Initialize Secondary Pre-buffer Player
      secondaryPlayerRef.current = new window.YT.Player(prebufferContainerRef.current, {
        height: '0',
        width: '0',
        playerVars: commonPlayerVars,
        events: {
          onReady: (event) => {
            if (setPrebufferPlayerRef) {
              setPrebufferPlayerRef(event.target);
            }
            event.target.setVolume(0); // Mute pre-buffer instance
          },
          onStateChange: (event) => {
            const state = event.data;
            if (state === window.YT.PlayerState.ENDED) {
              onTrackEndRef.current();
            }
          },
          onError: (event) => {
            console.warn('[Pre-buffer Player] Error event:', event.data);
          },
        },
      });
    };

    initPlayer();
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
      <div ref={prebufferContainerRef} id="youtube-prebuffer-player" />
    </div>
  );
});

export default YouTubePlayer;

