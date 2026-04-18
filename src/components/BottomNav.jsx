import { memo, useState } from 'react';
import './BottomNav.css';

const navItems = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'search', icon: 'search', label: 'Search' },
  { id: 'make-song', icon: 'auto_awesome', label: 'AI' },
  { id: 'library', icon: 'library_music', label: 'Library' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

const BottomNav = memo(function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`bottom-nav__item ${activeTab === item.id ? 'bottom-nav__item--active' : ''}`}
          onClick={() => onTabChange(item.id)}
          aria-label={item.label}
        >
          <span 
            className="material-symbols-outlined bottom-nav__icon" 
            style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {item.icon}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
});

export default BottomNav;
