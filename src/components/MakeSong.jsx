import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { refinePrompt, submitMusic, getFeed } from '../services/sunoService';
import './MakeSong.css';

const LOCAL_STORAGE_KEY = 'aurevon_generations';

const MakeSong = () => {
  const [idea, setIdea] = useState('');
  const [refinedData, setRefinedData] = useState(null);
  const [isRefining, setIsRefining] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState([]);
  const [error, setError] = useState(null);
  
  const pollInterval = useRef(null);
  const generationsRef = useRef(generations);

  // Keep ref in sync
  useEffect(() => {
    generationsRef.current = generations;
  }, [generations]);

  // Load generations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setGenerations(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved generations', e);
      }
    }
  }, []);

  // Save generations to localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(generations));
  }, [generations]);

  // Use Groq to refine the idea
  const handleRefine = async () => {
    if (!idea.trim()) return;
    setIsRefining(true);
    setError(null);
    try {
      const result = await refinePrompt(idea);
      setRefinedData(result);
    } catch (err) {
      setError('AI Refinement failed. Please try again.');
      console.error(err);
    } finally {
      setIsRefining(false);
    }
  };

  // Submit to Suno
  const handleGenerate = async () => {
    const data = refinedData || { title: 'Untitled Vibe', tags: 'ambient, melodic', prompt: idea };
    if (!data.prompt) return;

    setIsGenerating(true);
    setError(null);
    try {
      const result = await submitMusic({
        title: data.title,
        tags: data.tags,
        prompt: data.prompt
      });
      
      // result might contain multiple clips (usually 2 for Suno)
      const newClips = (result.clips || [result]).map(clip => ({
        id: clip.id || clip.clip_id,
        title: data.title,
        status: 'queued',
        audio_url: null,
        created_at: new Date().toISOString()
      }));

      setGenerations(prev => [...newClips, ...prev]);
      setRefinedData(null);
      setIdea('');
    } catch (err) {
      setError('Generation failed. Ensure your API key is valid.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Poll for status
  const startPolling = useCallback(async () => {
    const activeIds = generationsRef.current
      .filter(g => g.status === 'queued' || g.status === 'processing' || g.status === 'none')
      .map(g => g.id);

    if (activeIds.length === 0) {
      if (pollInterval.current) clearInterval(pollInterval.current);
      pollInterval.current = null;
      return;
    }

    try {
      const feed = await getFeed(activeIds);
      let updated = false;

      const newGenerations = generationsRef.current.map(g => {
        const found = feed.find(f => f.id === g.id);
        if (found && (found.status !== g.status || found.audio_url !== g.audio_url)) {
          updated = true;
          return {
            ...g,
            status: found.status,
            audio_url: found.audio_url || found.audio_url_primary || found.audio_url_secondary,
            image_url: found.image_url,
            duration: found.duration
          };
        }
        return g;
      });

      if (updated) setGenerations(newGenerations);
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, []);

  useEffect(() => {
    const activeExists = generations.some(g => g.status === 'queued' || g.status === 'processing' || g.status === 'none');
    if (activeExists && !pollInterval.current) {
      pollInterval.current = setInterval(startPolling, 5000);
    } else if (!activeExists && pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [generations, startPolling]);

  return (
    <div className="make-song">
      <header className="make-song__header">
        <h2 className="make-song__title">Create Your Sound</h2>
        <p className="make-song__subtitle">Powered by Suno AI & Groq</p>
      </header>

      <section className="make-song__input-section">
        <div className="make-song__card">
          <textarea
            className="make-song__textarea"
            placeholder="Describe your song idea... e.g., 'A nostalgic synthwave track about a neon city at night'"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          
          <div className="make-song__controls">
            <button 
              className={`make-song__btn make-song__btn--secondary ${isRefining ? 'processing' : ''}`}
              onClick={handleRefine}
              disabled={isRefining || !idea.trim()}
            >
              <span className="material-symbols-outlined">auto_fix_high</span>
              {isRefining ? 'Refining...' : 'Refine with AI'}
            </button>
            <button 
              className={`make-song__btn make-song__btn--primary ${isGenerating ? 'processing' : ''}`}
              onClick={handleGenerate}
              disabled={isGenerating || (!idea.trim() && !refinedData)}
            >
              <span className="material-symbols-outlined">bolt</span>
              {isGenerating ? 'Generating...' : 'Generate Song'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {refinedData && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="make-song__refined-card"
            >
              <div className="refined-field">
                <label>Title</label>
                <input 
                  value={refinedData.title} 
                  onChange={(e) => setRefinedData({...refinedData, title: e.target.value})}
                />
              </div>
              <div className="refined-field">
                <label>Style Tags</label>
                <input 
                  value={refinedData.tags} 
                  onChange={(e) => setRefinedData({...refinedData, tags: e.target.value})}
                />
              </div>
              <div className="refined-field">
                <label>Lyrics / Details</label>
                <textarea 
                  value={refinedData.prompt} 
                  onChange={(e) => setRefinedData({...refinedData, prompt: e.target.value})}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <div className="make-song__error">{error}</div>}
      </section>

      <section className="make-song__history">
        <h3 className="section-title">
          <span className="material-symbols-outlined section-title__icon">history</span>
          My Generations
        </h3>
        
        <div className="make-song__grid">
          {generations.length === 0 ? (
            <div className="make-song__empty">
              <span className="material-symbols-outlined">music_note</span>
              <p>No songs generated yet.</p>
            </div>
          ) : (
            generations.map((gen) => (
              <div key={gen.id} className="gen-card">
                <div className="gen-card__info">
                  <div className="gen-card__poster">
                    {gen.image_url ? (
                      <img src={gen.image_url} alt={gen.title} />
                    ) : (
                      <div className="gen-card__placeholder">
                        <span className="material-symbols-outlined">music_note</span>
                      </div>
                    )}
                    {gen.status !== 'complete' && (
                      <div className="gen-card__loader">
                        <div className="spinner"></div>
                      </div>
                    )}
                  </div>
                  <div className="gen-card__text">
                    <h4>{gen.title}</h4>
                    <span className={`status-badge ${gen.status}`}>
                      {gen.status === 'complete' ? 'Ready' : gen.status}
                    </span>
                  </div>
                </div>
                
                {gen.audio_url && (
                  <audio controls className="gen-card__audio">
                    <source src={gen.audio_url} type="audio/mpeg" />
                  </audio>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default MakeSong;
