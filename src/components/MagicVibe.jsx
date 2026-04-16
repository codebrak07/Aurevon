import { useState, memo, useCallback, useEffect } from 'react';
import usePlayer from '../hooks/usePlayer';
import { getPersonalizedMoods } from '../services/moodService';
import './MagicVibe.css';

const DEFAULT_MOODS = [
  { label: 'Chill', icon: '🌅', prompt: 'relaxing evening music, calm and warm' },
  { label: 'Energy', icon: '🔥', prompt: 'high energy workout music, intense and motivating' },
  { label: 'Focus', icon: '🧠', prompt: 'lo-fi beats, concentration music' },
];

const MagicVibe = memo(function MagicVibe() {
  const { startMagicVibe, magicLoading, magicError, likedSongs, listeningHistory } = usePlayer();
  const [prompt, setPrompt] = useState('');
  const [moodPresets, setMoodPresets] = useState(DEFAULT_MOODS);

  useEffect(() => {
    async function loadMoods() {
      try {
        const personalized = await getPersonalizedMoods(likedSongs, listeningHistory);
        setMoodPresets(personalized);
      } catch (err) {
        console.error('Failed to load personalized moods:', err);
        setMoodPresets(DEFAULT_MOODS);
      }
    }
    loadMoods();
  }, [likedSongs, listeningHistory]);

  const handleSubmit = useCallback((e) => {
    if(e) e.preventDefault();
    if (!prompt.trim() || magicLoading) return;
    startMagicVibe(prompt.trim());
    setPrompt('');
  }, [prompt, magicLoading, startMagicVibe]);

  const handlePreset = useCallback((presetPrompt) => {
    if (magicLoading) return;
    startMagicVibe(presetPrompt);
  }, [magicLoading, startMagicVibe]);

  return (
    <section className="magic-hero">
      <div className="magic-hero__container">
        {/* Animated Background Mesh */}
        <div className="magic-hero__mesh"></div>
        <div className="magic-hero__glow"></div>

        {/* Content Layer */}
        <div className="magic-hero__content">
          <div className="magic-hero__header">
            <div className="magic-hero__ai-presence">
              <div className="ai-presence__core"></div>
              <div className="ai-presence__ring"></div>
              <div className="ai-presence__echo"></div>
            </div>
            <span className="magic-hero__badge">Magic Vibe AI</span>
          </div>

          <h2 className="magic-hero__title">
            What's your <span className="text-glow">Vibe</span> today?
          </h2>

          <form className="magic-hero__form" onSubmit={handleSubmit}>
            <div className="magic-hero__input-wrapper">
              <input
                className="magic-hero__input"
                type="text"
                placeholder="Describe a mood or a memory..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={magicLoading}
              />
              <button
                className={`magic-hero__submit ${(!prompt.trim() || magicLoading) ? 'is-disabled' : 'is-active'}`}
                type="submit"
                disabled={!prompt.trim() || magicLoading}
              >
                {magicLoading ? (
                  <span className="material-symbols-outlined animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined">auto_awesome</span>
                )}
              </button>
            </div>
          </form>

          {/* Mood Chips - Horizontal Scroll */}
          <div className="magic-hero__presets-container">
            <div className="magic-hero__presets">
              {moodPresets.map((preset) => (
                <button
                  key={preset.label}
                  className="mood-chip"
                  onClick={() => handlePreset(preset.prompt || preset.label)}
                  disabled={magicLoading}
                >
                  <span className="mood-chip__icon">{preset.icon}</span>
                  <span className="mood-chip__label">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status & Errors */}
          {(magicLoading || magicError) && (
            <div className="magic-hero__status">
              {magicLoading && (
                <div className="status-loading">
                  <div className="status-loading__dots">
                    <span></span><span></span><span></span>
                  </div>
                  Curating your perfect soundscape...
                </div>
              )}
              {magicError && (
                <div className="status-error">
                  <span className="material-symbols-outlined">error</span>
                  {magicError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

export default MagicVibe;
