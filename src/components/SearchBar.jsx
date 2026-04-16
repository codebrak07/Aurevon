import { useState, useCallback, useEffect, useRef } from 'react';
import useDebounce from '../hooks/useDebounce';
import { searchTracks, searchArtists } from '../services/spotifyService';

export default function SearchBar({ onResults, onLoading, onError }) {
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
        <div className="absolute -inset-0.5 md:-inset-1 bg-gradient-to-r from-[#d394ff]/20 to-[#72fe8f]/20 rounded-full blur-[15px] md:blur-[20px] opacity-30 group-hover:opacity-60 transition duration-700"></div>
        
        {/* Search input container */}
        <div className="relative flex items-center bg-white/[0.04] backdrop-blur-3xl rounded-full p-2 md:p-5 border border-white/10 shadow-xl transition-all duration-300 focus-within:bg-white/[0.08] focus-within:border-white/20">
          <span className="material-symbols-outlined ml-3 md:ml-4 text-[#d394ff] text-[22px] md:text-[28px] opacity-80">search</span>
          
          <input
            id="search-input"
            type="text"
            className="w-full bg-transparent border-none outline-none focus:ring-0 text-base md:text-2xl font-['Manrope'] px-3 md:px-6 text-white placeholder:text-[#acaab1]/50 h-10 md:h-auto"
            placeholder="Search for songs, artists..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          
          {query && (
            <button 
              className="mr-2 md:mr-4 flex items-center justify-center p-1.5 md:p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#acaab1] hover:text-white transition-all active:scale-90" 
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
