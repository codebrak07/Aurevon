import { useEffect, useRef, memo } from 'react';
import usePlayer from '../hooks/usePlayer';

const YouTubePlayer = memo(function YouTubePlayer() {
  const { videoId, setPlayerRef, onTrackEnd, setPlayerReady, setUserInteracted, volume } =
    usePlayer();
  const containerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const isInitializedRef = useRef(false);
  const onTrackEndRef = useRef(onTrackEnd);

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
          autoplay: 1,
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
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              onTrackEndRef.current();
            }
            if (event.data === window.YT.PlayerState.PLAYING) {
              setUserInteracted();
            }
          },
          onError: (event) => {
            console.error('YouTube Player Error:', event.data);
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
