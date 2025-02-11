import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import PlaylistHeader from './PlaylistHeader';
import PlaylistStats from './PlaylistStats';
import TrackItem from '../tracks/TrackItem';
import { sortOptions } from '../../constants/sortOptions';
import { playlistCache, CACHE_DURATION, CACHE_KEYS } from '../../utils/cacheManager';
import { getPlaylistStats, getHeaderStats } from '../../utils/helpers';

const TRACKS_PER_PAGE = 50;

const PlaylistView = ({ 
  playlist,
  onBack,
  isPlaylistTransition,
  showPlaylistView,
  onTrackSelect,
  currentTrack,
  isPlaying,
  onAddToQueue
}) => {
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [playlistTotal, setPlaylistTotal] = useState(0);
  const [playlistOffset, setPlaylistOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [trackSortOrder, setTrackSortOrder] = useState('default');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [displayedTracks, setDisplayedTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const [cachedStats, setCachedStats] = useState({
    playlist: null,
    header: null
  });

  const loadingTimeoutRef = useRef(null);
  const playlistContainerRef = useRef(null);
  const loadingRef = useRef(null);
  const searchInputRef = useRef(null);

  const loadPlaylistTracks = useCallback(async () => {
    if (!playlist) return;
    
    setError(null);
    
    // Reset states when selecting a new playlist
    setPlaylistTracks([]);
    setPlaylistOffset(0);
    setHasMore(true);
    setIsLoading(true);
    
    // Reset scroll position
    if (playlistContainerRef.current) {
      playlistContainerRef.current.scrollTop = 0;
    }
    
    // Check cache first
    const cachedData = playlistCache.get(`tracks:${playlist.id}`, CACHE_DURATION.PLAYLIST);
    if (cachedData) {
      console.log(`Using cached data for playlist ${playlist.id}`);
      const { tracks, total, loadedCount } = cachedData;
      
      setPlaylistTracks(tracks);
      setDisplayedTracks(tracks);
      setPlaylistTotal(total);
      setPlaylistOffset(loadedCount); 
      setHasMore(tracks.length < total);
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await axios.get(`/api/spotify/playlists/${playlist.id}/tracks`, {
        params: {
          offset: 0,
          limit: TRACKS_PER_PAGE
        }
      });
      
      const { items: tracks, total } = response.data;
      setPlaylistTracks(tracks);
      setDisplayedTracks(tracks);
      setPlaylistTotal(total);
      
      const hasMore = tracks.length < total;
      setHasMore(hasMore);
      setPlaylistOffset(tracks.length);
      
      // Cache the fetched data with snapshot_id for invalidation
      playlistCache.set(`tracks:${playlist.id}`, {
        tracks,
        total,
        loadedCount: tracks.length,
        snapshot_id: playlist.snapshot_id
      }, CACHE_DURATION.PLAYLIST);
      
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 3;
        if (!isRetrying) {
          setIsRetrying(true);
          setTimeout(() => {
            setIsRetrying(false);
            loadPlaylistTracks();
          }, Math.min(retryAfter * 1000, 60000)); // Cap at 1 minute
        }
      } else {
        setError('Failed to load tracks. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [playlist, isRetrying]);

  const sortTracks = useCallback((tracks, order) => {
    if (!tracks || !Array.isArray(tracks)) return [];
    
    const sortedTracks = [...tracks];
    
    switch (order) {
      case 'name':
        return sortedTracks.sort((a, b) => {
          const nameA = (a?.name || '').toLowerCase();
          const nameB = (b?.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
      case 'artist':
        return sortedTracks.sort((a, b) => {
          const artistA = (a?.artists?.[0]?.name || '').toLowerCase();
          const artistB = (b?.artists?.[0]?.name || '').toLowerCase();
          return artistA.localeCompare(artistB);
        });
        
      case 'album':
        return sortedTracks.sort((a, b) => {
          const albumA = (a?.album?.name || '').toLowerCase();
          const albumB = (b?.album?.name || '').toLowerCase();
          return albumA.localeCompare(albumB);
        });
        
      case 'duration':
        return sortedTracks.sort((a, b) => {
          const durationA = a?.duration_ms || 0;
          const durationB = b?.duration_ms || 0;
          return durationA - durationB;
        });
        
      case 'date_added':
        return sortedTracks.reverse();
        
      default:
        return sortedTracks;
    }
  }, []);

  const loadMoreTracks = useCallback(async () => {
    if (!playlist?.id || isLoading || !hasMore || isRetrying) return;
    
    setIsLoading(true);
    
    // Save current scroll position
    const scrollContainer = playlistContainerRef.current;
    const currentScrollPos = scrollContainer?.scrollTop || 0;
    
    try {
      const response = await axios.get(`/api/spotify/playlists/${playlist.id}/tracks`, {
        params: {
          offset: playlistOffset,
          limit: TRACKS_PER_PAGE
        }
      });
      
      const { items: newTracks } = response.data;
      const updatedTracks = [...playlistTracks, ...newTracks];
      
      // Update playlist tracks first
      setPlaylistTracks(updatedTracks);
      
      // Then update displayed tracks with sorting
      setDisplayedTracks(sortTracks(updatedTracks, trackSortOrder));
      setPlaylistOffset(updatedTracks.length);
      setHasMore(updatedTracks.length < playlist.tracks.total);
      
      // Update cache with new tracks
      playlistCache.set(`tracks:${playlist.id}`, {
        tracks: updatedTracks,
        total: playlist.tracks.total,
        loadedCount: updatedTracks.length,
        snapshot_id: playlist.snapshot_id
      }, CACHE_DURATION.PLAYLIST);
      
      // Restore scroll position after a short delay to ensure rendering is complete
      if (scrollContainer && trackSortOrder !== 'default') {
        setTimeout(() => {
          scrollContainer.scrollTop = currentScrollPos;
        }, 50);
      }
      
    } catch (error) {
      console.error('Error loading more tracks:', error);
      if (error.response?.status === 429 && !isRetrying) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 3;
        setIsRetrying(true);
        setTimeout(() => {
          setIsRetrying(false);
          loadMoreTracks();
        }, retryAfter * 1000);
      }
    } finally {
      setIsLoading(false);
    }
  }, [playlist?.id, playlistOffset, isLoading, hasMore, playlistTracks, isRetrying, trackSortOrder, sortTracks]);

  const handleSortChange = useCallback((newOrder) => {
    // Save scroll position before sorting
    const scrollContainer = playlistContainerRef.current;
    const currentScrollPos = scrollContainer?.scrollTop || 0;
    
    setTrackSortOrder(newOrder);
    setDisplayedTracks(sortTracks(playlistTracks, newOrder));
    
    // Restore scroll position after sorting
    if (scrollContainer) {
      setTimeout(() => {
        scrollContainer.scrollTop = currentScrollPos;
      }, 50);
    }
  }, [playlistTracks, sortTracks]);

  const handleScroll = useCallback((e) => {
    if (!hasMore || isLoading || isRetrying) return;
    
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      loadMoreTracks();
    }
  }, [hasMore, isLoading, isRetrying, loadMoreTracks]);

  useEffect(() => {
    const container = playlistContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (showPlaylistView && playlist) {
      loadPlaylistTracks();
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loadPlaylistTracks, showPlaylistView, playlist]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSortDropdown && !event.target.closest('.sort-dropdown')) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortDropdown]);

  const updateStatsCache = useCallback(() => {
    if (!playlist?.id || !playlistTracks.length) return;

    // Calculate and cache playlist stats
    const playlistStats = getPlaylistStats(playlist, playlistTracks);
    playlistCache.set(CACHE_KEYS.STATS(playlist.id), playlistStats, CACHE_DURATION.STATS);
    
    // Calculate and cache header stats
    const headerStats = getHeaderStats(playlist, playlistTracks);
    playlistCache.set(CACHE_KEYS.HEADER_STATS(playlist.id), headerStats, CACHE_DURATION.HEADER);

    setCachedStats({
      playlist: playlistStats,
      header: headerStats
    });
  }, [playlist?.id, playlistTracks]);

  useEffect(() => {
    updateStatsCache();
  }, [updateStatsCache]);

  const clearPlaylistCache = useCallback(() => {
    if (!playlist?.id) return;
    playlistCache.remove(`tracks:${playlist.id}`);
    playlistCache.remove(CACHE_KEYS.STATS(playlist.id));
    playlistCache.remove(CACHE_KEYS.HEADER_STATS(playlist.id));
    loadPlaylistTracks();
  }, [playlist?.id, loadPlaylistTracks]);

  const scrollToTop = () => {
    if (playlistContainerRef.current) {
      playlistContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const scrollToBottom = () => {
    if (playlistContainerRef.current) {
      playlistContainerRef.current.scrollTo({
        top: playlistContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Filter tracks based on search query
  useEffect(() => {
    if (!searchQuery.trim() || !playlistTracks) {
      setDisplayedTracks(sortTracks(playlistTracks || [], trackSortOrder));
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = playlistTracks.filter(track => {
      if (!track) return false;
      
      const songName = (track.name || '').toLowerCase();
      const artistNames = track.artists
        ? track.artists.map(artist => (artist?.name || '').toLowerCase())
        : [];
      const albumName = (track.album?.name || '').toLowerCase();
      
      return songName.includes(query) ||
        artistNames.some(name => name.includes(query)) ||
        albumName.includes(query);
    });

    setDisplayedTracks(sortTracks(filtered, trackSortOrder));
  }, [searchQuery, playlistTracks, trackSortOrder, sortTracks]);

  // Clear search when changing playlists
  useEffect(() => {
    setSearchQuery('');
  }, [playlist?.id]);

  const handleKeyDown = (e) => {
    // Ctrl/Cmd + F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    // Escape to clear and blur search
    if (e.key === 'Escape') {
      setSearchQuery('');
      searchInputRef.current?.blur();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ 
        x: showPlaylistView ? 0 : "100%",
        opacity: showPlaylistView ? 1 : 0
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 w-full h-full bg-gradient-to-b from-purple-900/20 to-black/20 backdrop-blur-xl overflow-hidden"
    >
      <div className="h-full w-full overflow-y-auto" ref={playlistContainerRef}>
        <div className="container mx-auto px-12 py-8">
          <PlaylistHeader 
            playlist={playlist}
            onBack={onBack}
            tracks={displayedTracks}
            cachedStats={cachedStats.header}
          />

          <PlaylistStats 
            playlist={playlist} 
            tracks={displayedTracks}
            cachedStats={cachedStats.playlist}
          />
          
          {/* Search and Sort Controls */}
          <div className="flex justify-between items-center mb-4 mt-8">
            {/* Search Bar */}
            <div className="relative w-96">
              <div className={`absolute inset-y-0 left-3 flex items-center pointer-events-none transition-opacity duration-300 ${isFocused || searchQuery ? 'opacity-100' : 'opacity-70'}`}>
                {isLoading ? (
                  <svg 
                    className="animate-spin h-5 w-5 text-purple-300" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg 
                    className="w-5 h-5 text-purple-300"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                    />
                  </svg>
                )}
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={isLoading ? "Loading tracks..." : "Search songs, artists, or albums..."}
                disabled={isLoading}
                className={`
                  w-full pl-10 pr-4 py-2 
                  bg-purple-900/20 
                  border-2 transition-all duration-300
                  ${isFocused ? 'border-purple-500/50' : 'border-transparent'} 
                  rounded-lg 
                  text-white placeholder-purple-300/50
                  focus:outline-none focus:ring-2 focus:ring-purple-500/30
                  backdrop-blur-sm
                  ${isLoading ? 'cursor-wait opacity-75' : ''}
                `}
              />
              {searchQuery && !isLoading && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300/70 hover:text-purple-300 transition-colors"
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M6 18L18 6M6 6l12 12" 
                    />
                  </svg>
                </button>
              )}
              {/* Search Results Count */}
              {searchQuery && !isLoading && (
                <div className="absolute -bottom-6 left-0 text-sm text-purple-300/70">
                  Found {displayedTracks.length} {displayedTracks.length === 1 ? 'track' : 'tracks'}
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative sort-dropdown">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="group relative bg-purple-600/20 hover:bg-purple-600/40 p-3 rounded-lg shadow-lg transition-all duration-300"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                </div>
                <div className="relative flex items-center gap-2">
                  {sortOptions.find(opt => opt.id === trackSortOrder)?.icon}
                  <span className="text-sm font-medium">
                    {sortOptions.find(opt => opt.id === trackSortOrder)?.label}
                  </span>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Dropdown Menu */}
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-gradient-to-br from-purple-900/95 to-black/95 backdrop-blur-sm shadow-xl z-50">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        handleSortChange(option.id);
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-white/10 transition-colors flex items-center ${
                        trackSortOrder === option.id ? 'bg-purple-700/30 text-purple-300' : 'text-gray-200'
                      }`}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 space-y-2 pb-32">
            {displayedTracks.map((track, index) => (
              <TrackItem
                key={`${track.id}-${index}`}
                track={track}
                onClick={() => onTrackSelect(track, displayedTracks)}
                onAddToQueue={onAddToQueue}
                isPlaying={isPlaying && currentTrack?.id === track.id}
                index={index + 1}
              />
            ))}
            {(hasMore || isLoadingMore) && (
              <div ref={loadingRef} className="py-4 text-center text-purple-400">
                {isLoadingMore ? 'Loading more tracks...' : 'Scroll for more'}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="fixed bottom-8 right-8 flex flex-col gap-4">
        <button
          onClick={scrollToTop}
          className="group relative bg-purple-600/20 hover:bg-purple-600/40 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-purple-500/30"
          title="Scroll to Top"
        >
          <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-md group-hover:blur-xl transition-all duration-300"></div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-6 w-6 text-white relative z-10 transform rotate-180" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 14l-7 7m0 0l-7-7m7 7V3" 
            />
          </svg>
        </button>
        
        <button
          onClick={scrollToBottom}
          className="group relative bg-purple-600/20 hover:bg-purple-600/40 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-purple-500/30"
          title="Scroll to Bottom"
        >
          <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-md group-hover:blur-xl transition-all duration-300"></div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-6 w-6 text-white relative z-10" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 14l-7 7m0 0l-7-7m7 7V3" 
            />
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

export default PlaylistView;
