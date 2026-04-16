import { useCallback, useRef, memo } from 'react';
import usePlayer from '../hooks/usePlayer';
import { formatTime } from '../utils/mappers';
import './SeekBar.css';

const SeekBar = memo(function SeekBar() {
  const { currentTime, duration, seekTo } = usePlayer();
  const barRef = useRef(null);
  const isDragging = useRef(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const getTimeFromEvent = useCallback(
    (e) => {
      if (!barRef.current || !duration) return 0;
      const rect = barRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (e) => {
      isDragging.current = true;
      const time = getTimeFromEvent(e);
      seekTo(time);

      const handleMove = (ev) => {
        if (isDragging.current) {
          const t = getTimeFromEvent(ev);
          seekTo(t);
        }
      };

      const handleUp = () => {
        isDragging.current = false;
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
    [getTimeFromEvent, seekTo]
  );

  return (
    <div className="seek-bar">
      <span className="seek-bar__time">{formatTime(currentTime)}</span>
      <div
        className="seek-bar__track"
        ref={barRef}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
      >
        <div className="seek-bar__fill" style={{ width: `${progress}%` }}>
          <div className="seek-bar__thumb" />
        </div>
      </div>
      <span className="seek-bar__time">{formatTime(duration)}</span>
    </div>
  );
});

export default SeekBar;
