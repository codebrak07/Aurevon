import { useState, memo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import usePlayer from '../hooks/usePlayer';
import './MagicVibe.css';

const GENRES = ['Bollywood', 'Pop', 'Lo-Fi', 'Classical', 'Hip-Hop', 'House', 'Jazz', 'Rock'];
const LANGUAGES = ['Hindi', 'English', 'Both'];

const MagicVibe = memo(function MagicVibe() {
  const { startMagicVibe, magicLoading, magicError } = usePlayer();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    mood: '',
    genre: 'Pop',
    language: 'English',
    referenceSongs: ''
  });

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    if (magicLoading) return;
    startMagicVibe(formData);
  }, [formData, magicLoading, startMagicVibe]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <section className="magic-hero">
      <div className="magic-hero__container">
        <div className="magic-hero__mesh"></div>
        <div className="magic-hero__glow"></div>

        <div className="magic-hero__content">
          <div className="magic-hero__header">
            <div className="magic-hero__ai-presence">
              <div className="ai-presence__core"></div>
              <div className="ai-presence__ring"></div>
            </div>
            <span className="magic-hero__badge">Magic Vibe AI 2.0</span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-2xl mx-auto"
              >
                <h2 className="magic-hero__title">What's your <span className="text-glow">Vibe</span> today?</h2>
                <div className="space-y-8 mt-10">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">How are you feeling?</p>
                    <input
                      className="magic-v2-input"
                      type="text"
                      placeholder="e.g. A rainy day memory, or high-energy workout..."
                      value={formData.mood}
                      onChange={(e) => updateField('mood', e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">Choose a Genre</p>
                    <div className="flex flex-wrap gap-3">
                      {GENRES.map(g => (
                        <button 
                          key={g}
                          onClick={() => updateField('genre', g)}
                          className={`genre-chip ${formData.genre === g ? 'is-active' : ''}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleNext} className="magic-v2-btn-primary w-full py-5">
                    Continue
                    <span className="material-symbols-outlined ml-2">arrow_forward</span>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-2xl mx-auto"
              >
                <h2 className="magic-hero__title">Final <span className="text-glow">Touches</span></h2>
                <div className="space-y-8 mt-10">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">Preferred Language</p>
                    <div className="grid grid-cols-3 gap-3">
                      {LANGUAGES.map(l => (
                        <button 
                          key={l}
                          onClick={() => updateField('language', l)}
                          className={`genre-chip text-center flex justify-center py-4 ${formData.language === l ? 'is-active' : ''}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">Any example songs? (Optional)</p>
                    <textarea
                      className="magic-v2-input min-h-[100px] py-4"
                      placeholder="e.g. Pehle Bhi Main, or Blinding Lights..."
                      value={formData.referenceSongs}
                      onChange={(e) => updateField('referenceSongs', e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4">
                    <button onClick={handlePrev} className="magic-v2-btn-secondary px-8">
                      Back
                    </button>
                    <button 
                      onClick={handleSubmit} 
                      disabled={magicLoading}
                      className="magic-v2-btn-primary flex-1 py-5"
                    >
                      {magicLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin mr-2">sync</span>
                          Analyzing Trends...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined mr-2">auto_awesome</span>
                          Generate My Vibe
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {magicError && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">error</span>
              {magicError}
            </motion.div>
          )}

        </div>
      </div>
    </section>
  );
});

export default MagicVibe;
