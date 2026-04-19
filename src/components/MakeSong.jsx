import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as sunoService from '../services/sunoService';
import * as musicfulService from '../services/musicfulService';
import * as loudlyService from '../services/loudlyService';
import { refineSongPrompt as refinePrompt } from '../services/aiService';
import './MakeSong.css';

const LOCAL_STORAGE_KEY = 'aurevon_generations';

const MakeSong = () => {
  const [idea, setIdea] = useState('');
  const [refinedData, setRefinedData] = useState(null);
  const [isRefining, setIsRefining] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState([]);
  const [provider, setProvider] = useState('suno'); // 'suno', 'musicful', or 'loudly'
  const [duration, setDuration] = useState(60); // Default for Loudly
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
    try {
      let service;
      if (provider === 'musicful') service = musicfulService;
      else if (provider === 'loudly') service = loudlyService;
      else service = sunoService;
      
      const result = await service.submitMusic({
        title: data.title,
        tags: data.tags,
        prompt: data.prompt,
        duration: provider === 'loudly' ? duration : undefined
      });
      
      const newClip = {
        id: result.task_id,
        title: data.title || 'Untitled',
        status: result.status || 'queued',
        provider: provider,
        audio_url: result.clips?.[0]?.audio_url || null,
        image_url: result.clips?.[0]?.image_url || null,
        duration: result.clips?.[0]?.duration || 0,
        created_at: new Date().toISOString()
      };

      setGenerations(prev => [newClip, ...prev]);
      setRefinedData(null);
      setIdea('');
    } catch (err) {
      console.error('[Generation Error]:', err);
      // Ensure the error is reported as a string to prevent [object Object] rendering
      setError(err.message || 'Generation failed. Please try again.');
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
      const pendingGens = generationsRef.current.filter(g => 
        g.status === 'queued' || g.status === 'processing' || g.status === 'none'
      );

      const providersToPoll = [...new Set(pendingGens.map(g => g.provider || 'suno'))];
      
      let allFeedResults = [];
      
      for (const p of providersToPoll) {
        if (p === 'loudly') continue; // Loudly is synchronous
        const ids = pendingGens.filter(g => (g.provider || 'suno') === p).map(g => g.id);
        const service = p === 'musicful' ? musicfulService : sunoService;
        try {
          const feed = await service.getFeed(ids);
          allFeedResults = [...allFeedResults, ...feed];
        } catch (e) {
          console.error(`Polling error for ${p}:`, e);
        }
      }

      let updated = false;
      const newGenerations = generationsRef.current.map(g => {
        const found = allFeedResults.find(f => f.id === g.id);
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
      console.error('Master polling error:', err);
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
        <div className="make-song__provider-selector">
          <button 
            className={`provider-btn ${provider === 'suno' ? 'active' : ''}`}
            onClick={() => setProvider('suno')}
          >
            Suno AI
          </button>
          <button 
            className={`provider-btn ${provider === 'musicful' ? 'active' : ''}`}
            onClick={() => setProvider('musicful')}
          >
            Musicful AI
          </button>
          <button 
            className={`provider-btn ${provider === 'loudly' ? 'active' : ''}`}
            onClick={() => setProvider('loudly')}
          >
            Soundly AI
          </button>
        </div>
        <p className="make-song__subtitle">
          Powered by {provider === 'suno' ? 'Suno AI' : (provider === 'musicful' ? 'Musicful AI' : 'Soundly AI')} & Groq
        </p>
      </header>

      <section className="make-song__input-section">
        <div className="make-song__card">
          <textarea
            className="make-song__textarea"
            placeholder="Describe your song idea... e.g., 'A nostalgic synthwave track about a neon city at night'"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          
          {provider === 'loudly' && (
            <div className="make-song__duration-control">
              <div className="duration-label">
                <span>Duration</span>
                <span className="duration-value">{duration}s</span>
              </div>
              <input 
                type="range"
                min="30"
                max="420"
                step="10"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="duration-slider"
              />
            </div>
          )}
          
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
                    <div className="gen-card__badges">
                      <span className={`status-badge ${gen.status}`}>
                        {gen.status === 'complete' ? 'Ready' : gen.status}
                      </span>
                      <span className="provider-badge">
                        {gen.provider || 'suno'}
                      </span>
                    </div>
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
