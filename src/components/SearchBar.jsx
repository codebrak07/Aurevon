import { useState, useCallback, useEffect, useRef } from 'react';
import useDebounce from '../hooks/useDebounce';
import { searchTracks, searchArtists } from '../services/spotifyService';

const noop = () => {};

export default function SearchBar({ onResults = noop, onLoading = noop, onError = noop }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const abortRef = useRef(null);

  const handleSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      onResults({ tracks: [], artists: [] });
      onLoading(false);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    onLoading(true);
    onError(null);

    try {
      const [trackResults, artistResults] = await Promise.all([
        searchTracks(searchQuery, abortRef.current?.signal),
        searchArtists(searchQuery)
      ]);
      
      onResults({ 
        tracks: trackResults, 
        artists: artistResults 
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError(err.message);
        onResults({ tracks: [], artists: [] });
      }
    } finally {
      onLoading(false);
    }
  }, [onResults, onLoading, onError]);

  useEffect(() => {
    handleSearch(debouncedQuery);
  }, [debouncedQuery, handleSearch]);

  const handleClear = () => {
    setQuery('');
    onResults({ tracks: [], artists: [] });
    if (abortRef.current) abortRef.current.abort();
  };

  return (
    <section className="mb-6 w-full px-1">
      <div className="relative group mx-1 md:mx-0">
        {/* Glow behind the search bar - slightly smaller spread on mobile */}
        <div className="absolute -inset-0.5 md:-inset-1 bg-gradient-to-r from-[var(--accent-purple)]/20 to-[var(--accent-green)]/20 rounded-full blur-[15px] md:blur-[20px] opacity-30 group-hover:opacity-60 transition duration-700"></div>
        
        {/* Search input container */}
        <div className="relative flex items-center bg-[var(--bg-glass-heavy)] backdrop-blur-3xl rounded-full p-2 md:p-5 border border-[var(--glass-border)] shadow-xl transition-all duration-300 focus-within:bg-[var(--surface-container-high)] focus-within:border-[var(--accent-green)]/30">
          <span className="material-symbols-outlined ml-3 md:ml-4 text-[var(--accent-purple)] text-[22px] md:text-[28px]">search</span>
          
          <input
            id="search-input"
            type="text"
            className="w-full bg-transparent border-none outline-none focus:ring-0 text-base md:text-2xl font-['Manrope'] px-3 md:px-6 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:font-medium h-10 md:h-auto"
            placeholder="Search for songs, artists..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          
          {query && (
            <button 
              className="mr-2 md:mr-4 flex items-center justify-center p-1.5 md:p-2 rounded-full bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90" 
              onClick={handleClear} 
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined text-[18px] md:text-[24px]">close</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
