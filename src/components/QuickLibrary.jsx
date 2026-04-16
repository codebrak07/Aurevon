import { memo } from 'react';
import usePlayer from '../hooks/usePlayer';
import './QuickLibrary.css';

const QuickLibrary = memo(function QuickLibrary({ onOpenLibrary }) {
  const { likedSongs, playlists } = usePlayer();

  return (
    <section className="quick-library">
      <div className="quick-library__header">
        <h3 className="section-title">Your Sonic Gallery</h3>
      </div>
      
      <div className="quick-library__grid">
        {/* Liked Songs Tile (Hero) */}
        <div 
          className="library-hero"
          onClick={() => onOpenLibrary('liked')}
        >
          <div className="library-hero__overlay"></div>
          <div className="library-hero__content">
            <div className="library-hero__icon">
              <span className="material-symbols-outlined">favorite</span>
            </div>
            <div className="library-hero__info">
              <h4 className="library-hero__title">Liked Songs</h4>
              <p className="library-hero__count">{likedSongs.length} favorites</p>
            </div>
            <button className="library-hero__play-btn">
              <span className="material-symbols-outlined">play_arrow</span>
            </button>
          </div>
        </div>

        {/* Playlists Tile (Mid) */}
        <div 
          className="library-tile library-tile--playlists"
          onClick={() => onOpenLibrary('playlists')}
        >
          <div className="library-tile__content">
            <span className="material-symbols-outlined library-tile__icon">library_music</span>
            <h4 className="library-tile__title">Playlists</h4>
            <span className="library-tile__count">{playlists.length} packs</span>
          </div>
        </div>

        {/* Magic Mix Tile (Small/Asymmetrical) */}
        <div 
          className="library-tile library-tile--magic"
          onClick={() => onOpenLibrary('liked')} // Just an example
        >
          <div className="library-tile__content">
            <span className="material-symbols-outlined library-tile__icon">auto_awesome</span>
            <h4 className="library-tile__title">Magic Mix</h4>
          </div>
        </div>
      </div>
    </section>
  );
});

export default QuickLibrary;
