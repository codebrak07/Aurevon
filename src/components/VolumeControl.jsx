import { useCallback, useRef, memo, useState } from 'react';
import usePlayer from '../hooks/usePlayer';
import './VolumeControl.css';

const VolumeControl = memo(function VolumeControl() {
  const { volume, setVolume } = usePlayer();
  const [prevVolume, setPrevVolume] = useState(80);
  const barRef = useRef(null);

  const getVolFromEvent = useCallback((e) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 100);
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      const vol = getVolFromEvent(e);
      setVolume(vol);

      const handleMove = (ev) => {
        const v = getVolFromEvent(ev);
        setVolume(v);
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      document.addEventListener('touchmove', handleMove, { passive: true });
      document.addEventListener('touchend', handleUp);
    },
    [getVolFromEvent, setVolume]
  );

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume || 80);
    }
  }, [volume, prevVolume, setVolume]);

  const getVolumeIcon = () => {
    if (volume === 0) {
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
        </svg>
      );
    }
    if (volume < 50) {
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    );
  };

  return (
    <div className="volume-control">
      <button className="volume-control__btn" onClick={toggleMute} aria-label="Toggle mute">
        {getVolumeIcon()}
      </button>
      <div
        className="volume-control__track"
        ref={barRef}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volume}
      >
        <div className="volume-control__fill" style={{ width: `${volume}%` }} />
      </div>
    </div>
  );
});

export default VolumeControl;
