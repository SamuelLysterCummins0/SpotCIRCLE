import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import PlaylistHeader from './PlaylistHeader';
import PlaylistStats from './PlaylistStats';
import TrackItem from '../tracks/TrackItem';
import { sortOptions } from '../../constants/sortOptions';
import { playlistCache, CACHE_DURATION, CACHE_KEYS } from '../../utils/cacheManager';
import { getPlaylistStats, getHeaderStats } from '../../utils/helpers';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

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
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [isPlaylistFullyLoaded, setIsPlaylistFullyLoaded] = useState(false);
  const [cachedStats, setCachedStats] = useState({
    playlist: null,
    header: null
  });
  const [loadedTrackIds] = useState(() => new Set());

  const loadingTimeoutRef = useRef(null);
  const playlistContainerRef = useRef(null);
  const loadingRef = useRef(null);
  const searchInputRef = useRef(null);
  const backgroundLoadingRef = useRef(false);
  const listRef = useRef(null);

  const HEADER_HEIGHT = 550;
  const ITEM_HEIGHT = 68;

  const getItemSize = useCallback((index) => {
    return index === 0 ? HEADER_HEIGHT : ITEM_HEIGHT;
  }, []);

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

  const addTracksToState = useCallback((newTracks, total) => {
    // Filter out duplicates
    const uniqueNewTracks = newTracks.filter(track => !loadedTrackIds.has(track.id));
    
    if (uniqueNewTracks.length === 0) {
      setHasMore(false);
      setIsPlaylistFullyLoaded(true);
      return false;
    }
    
    // Add new track IDs to our set
    uniqueNewTracks.forEach(track => loadedTrackIds.add(track.id));
    
    setPlaylistTracks(prev => {
      const updated = [...prev, ...uniqueNewTracks];
      // Update cache with new tracks
      playlistCache.set(`tracks:${playlist.id}`, {
        tracks: updated,
        total: total,
        loadedCount: updated.length,
        snapshot_id: playlist.snapshot_id,
        isFullyLoaded: loadedTrackIds.size >= total
      }, CACHE_DURATION.PLAYLIST);
      return updated;
    });
    
    setDisplayedTracks(prev => [...prev, ...uniqueNewTracks]);
    setPlaylistOffset(prev => prev + uniqueNewTracks.length);
    
    // Check if we've loaded all tracks
    if (loadedTrackIds.size >= total) {
      setIsPlaylistFullyLoaded(true);
      setHasMore(false);
      return false;
    }
    
    return true;
  }, [playlist?.id, loadedTrackIds]);

  const loadMoreTracks = useCallback(async () => {
    if (!playlist?.id || 
        isLoading || 
        !hasMore || 
        isRetrying || 
        isBackgroundLoading || 
        isPlaylistFullyLoaded) return;
    
    setIsLoading(true);
    
    try {
      const response = await axios.get(`/api/spotify/playlists/${playlist.id}/tracks`, {
        params: {
          offset: playlistOffset,
          limit: TRACKS_PER_PAGE
        }
      });
      
      const { items: newTracks, total } = response.data;
      addTracksToState(newTracks, total);
      
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
  }, [playlist?.id, playlistOffset, isLoading, hasMore, isRetrying, 
      isBackgroundLoading, isPlaylistFullyLoaded, addTracksToState]);

  const loadPlaylistTracksInBackground = useCallback(async () => {
    if (!playlist?.id || 
        backgroundLoadingRef.current || 
        playlistTracks.length >= playlistTotal ||
        playlistTracks.length === 0 ||
        isBackgroundLoading ||
        isPlaylistFullyLoaded) return;
    
    backgroundLoadingRef.current = true;
    setIsBackgroundLoading(true);
    
    const delay = (ms) => new Promise(resolve => {
      loadingTimeoutRef.current = setTimeout(resolve, ms);
      return loadingTimeoutRef.current;
    });
    
    try {
      let currentOffset = playlistTracks.length;
      const batchSize = TRACKS_PER_PAGE;
      const delayBetweenBatches = 2000;
      let noNewTracksCount = 0;
      let lastBatchTime = Date.now();
      
      while (currentOffset < playlistTotal) {
        if (!backgroundLoadingRef.current) break;
        
        const timeSinceLastBatch = Date.now() - lastBatchTime;
        if (timeSinceLastBatch < delayBetweenBatches) {
          console.log(`Waiting ${(delayBetweenBatches - timeSinceLastBatch)/1000}s before next batch...`);
          await delay(delayBetweenBatches - timeSinceLastBatch);
        }
        
        console.log(`Loading batch at offset ${currentOffset} of ${playlistTotal}`);
        lastBatchTime = Date.now();
        
        const response = await axios.get(`/api/spotify/playlists/${playlist.id}/tracks`, {
          params: {
            offset: currentOffset,
            limit: batchSize
          },
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
          }
        });
        
        const { items: newTracks, total } = response.data;
        
        if (!newTracks?.length || currentOffset >= total) {
          console.log('No more tracks to load or reached end');
          setIsPlaylistFullyLoaded(true);
          break;
        }
        
        const shouldContinue = addTracksToState(newTracks, total);
        if (!shouldContinue) {
          if (++noNewTracksCount >= 2) {
            console.log('Multiple batches with no new tracks, assuming playlist is complete');
            break;
          }
        } else {
          noNewTracksCount = 0;
        }
        
        currentOffset += batchSize;
      }
      
      console.log('Background loading complete');
    } catch (error) {
      console.error('Background loading error:', error);
    } finally {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setIsBackgroundLoading(false);
      backgroundLoadingRef.current = false;
    }
  }, [playlist?.id, playlistTracks.length, playlistTotal, isBackgroundLoading, 
      isPlaylistFullyLoaded, addTracksToState]);

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

  const handleScroll = useCallback(({ scrollOffset }) => {
    if (!hasMore || isLoading || isRetrying || isBackgroundLoading || isPlaylistFullyLoaded) return;
    
    const scrollContainer = playlistContainerRef.current;
    if (!scrollContainer) return;
    
    const scrollHeight = displayedTracks.length * ITEM_HEIGHT;
    const containerHeight = scrollContainer.clientHeight;
    
    if (scrollHeight - scrollOffset <= containerHeight * 1.5) {
      loadMoreTracks();
    }
  }, [hasMore, isLoading, isRetrying, loadMoreTracks, isBackgroundLoading, isPlaylistFullyLoaded, displayedTracks.length]);

  const scrollToPosition = (position, isScrollingUp) => {
    if (!listRef.current) return;
    
    const startPosition = listRef.current.state.scrollOffset;
    const distance = position - startPosition;
    const totalItems = listRef.current.props.itemCount;
    
    // Faster duration for end-of-list scrolls
    const minDuration = 1500;
    const maxDuration = 2500; // Reduced from 3000
    const duration = Math.min(maxDuration, 
      minDuration + (Math.abs(distance) / ITEM_HEIGHT) * 40 // Reduced multiplier
    );
    
    const startTime = performance.now();
    let isEnding = false;
    
    // Detect if we're scrolling to the end or start
    const isEndScroll = position >= (totalItems - 1) * ITEM_HEIGHT - listRef.current._outerRef.clientHeight;
    const isStartScroll = position <= 0;
    
    const customEasing = (t) => {
      // Start ending sooner for end/start scrolls
      if ((isEndScroll || isStartScroll) && t > 0.6 && !isEnding) {
        isEnding = true;
      } else if (t > 0.75 && !isEnding) {
        isEnding = true;
      }
      
      // Faster easing curve
      const easeOut = 1 - Math.pow(1 - t, 3);
      
      // Quicker ending for end/start scrolls
      if (isEndScroll || isStartScroll) {
        if (t > 0.6) {
          const endProgress = (t - 0.6) / 0.4;
          return easeOut * (1 - endProgress * 1.5) + endProgress * 1.5; // Faster end transition
        }
      } else if (t > 0.75) {
        const endProgress = (t - 0.75) / 0.25;
        return easeOut * (1 - endProgress) + endProgress;
      }
      
      return easeOut;
    };

    let lastEffectTime = startTime;
    const effectInterval = 16;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const eased = customEasing(progress);
      const currentPosition = startPosition + (distance * eased);
      
      listRef.current.scrollTo(currentPosition);
      
      if (currentTime - lastEffectTime > effectInterval) {
        const viewportHeight = listRef.current._outerRef.clientHeight;
        const bufferItems = Math.ceil(viewportHeight / ITEM_HEIGHT) + 8; // Increased buffer
        
        // Calculate visible range including items just outside viewport
        const firstVisible = Math.max(1, Math.floor(currentPosition / ITEM_HEIGHT) - 4);
        const lastVisible = Math.min(totalItems - 1, firstVisible + bufferItems);
        
        const visibleIndices = Array.from(
          { length: lastVisible - firstVisible + 1 },
          (_, i) => firstVisible + i
        );
        
        visibleIndices.forEach((index) => {
          if (index === 0) return;
          
          const element = listRef.current._outerRef.querySelector(`[data-index="${index}"]`);
          if (element) {
            const itemPosition = index * ITEM_HEIGHT;
            const distanceFromMiddle = Math.abs(currentPosition - itemPosition) / ITEM_HEIGHT;
            
            // Adjust scale effect based on position in list
            let scaleEffect = Math.max(0, 1 - (distanceFromMiddle * 0.15));
            
            // Enhance effect for end/start items
            if (isEndScroll && index >= totalItems - 5) {
              scaleEffect *= (1 + (totalItems - index) * 0.1); // Boost effect for last few items
            } else if (isStartScroll && index <= 5) {
              scaleEffect *= (1 + index * 0.1); // Boost effect for first few items
            }
            
            // Further increased scale range for more dramatic inward movement
            const scale = 0.75 + (scaleEffect * 0.25);
            const yOffset = (1 - scaleEffect) * 4;
            
            element.style.transform = `scale(${scale}) translateY(${yOffset}px)`;
            // Faster transition at the end
            const transitionDuration = isEnding ? 400 : 300;
            element.style.transition = `transform ${transitionDuration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
            
            // Faster cleanup
            if ((progress > 0.9 && isEnding) || distanceFromMiddle > 4) {
              element.style.transform = '';
              element.style.transition = 'transform 400ms cubic-bezier(0.4, 0.0, 0.2, 1)';
            }
          }
        });
        
        lastEffectTime = currentTime;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const elements = listRef.current._outerRef.querySelectorAll('[data-index]');
        elements.forEach(element => {
          if (element.getAttribute('data-index') !== '0') {
            element.style.transition = 'transform 400ms cubic-bezier(0.4, 0.0, 0.2, 1)';
            element.style.transform = '';
          }
        });
      }
    };
    
    requestAnimationFrame(animate);
  };

  const scrollToTop = () => {
    scrollToPosition(0, true);
  };

  const scrollToBottom = () => {
    if (!listRef.current) return;
    const totalHeight = displayedTracks.length * ITEM_HEIGHT + HEADER_HEIGHT;
    scrollToPosition(totalHeight - listRef.current._outerRef.clientHeight, false);
  };

  const Row = useCallback(({ index, style }) => {
    if (index === 0) {
      return (
        <div className="w-full" style={{ ...style, position: 'absolute', left: 0, right: 0 }} data-index={index}>
          <div className="container mx-auto px-12 py-8">
            <PlaylistHeader
              playlist={playlist}
              onBack={onBack}
              tracks={displayedTracks}
              cachedStats={cachedStats.header}
              isTransitioning={isPlaylistTransition}
            />
            
            <PlaylistStats
              playlist={playlist}
              tracks={displayedTracks}
              cachedStats={cachedStats.playlist}
              className="mt-8"
            />
            
            {/* Search and sort controls */}
            <div className="flex items-center justify-between mb-6 mt-8">
              <div className="relative flex-1 max-w-md">
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
                  onChange={handleSearchChange}
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
          </div>
        </div>
      );
    }
    
    const trackIndex = index - 1;
    const track = displayedTracks[trackIndex];
    if (!track) return null;
    
    return (
      <div className="w-full" style={{ ...style, position: 'absolute', left: 0, right: 0 }} data-index={index}>
        <div className="container mx-auto px-12">
          <TrackItem
            key={`${track.id}-${trackIndex}`}
            track={track}
            onClick={() => onTrackSelect(track, displayedTracks)}
            onAddToQueue={onAddToQueue}
            isPlaying={isPlaying && currentTrack?.id === track.id}
            index={trackIndex + 1}
          />
        </div>
      </div>
    );
  }, [displayedTracks, onTrackSelect, currentTrack, isPlaying, onAddToQueue]);

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

  useEffect(() => {
    loadedTrackIds.clear();
    setIsPlaylistFullyLoaded(false);
    setHasMore(true);
  }, [playlist?.id, loadedTrackIds]);

  // Cleanup on unmount or playlist change
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      backgroundLoadingRef.current = false;
      setIsBackgroundLoading(false);
    };
  }, [playlist?.id]);

  // Trigger background loading when playlist is loaded and has more than 200 tracks
  useEffect(() => {
    if (playlist?.tracks?.total > 200 && 
        playlistTracks.length > 0 && 
        playlistTracks.length < playlistTotal && 
        !backgroundLoadingRef.current &&
        !isBackgroundLoading &&
        !isPlaylistFullyLoaded) {
      console.log('Starting background load for large playlist:', playlist.name);
      loadPlaylistTracksInBackground();
    }
  }, [playlist, playlistTracks.length, playlistTotal, loadPlaylistTracksInBackground, isBackgroundLoading, isPlaylistFullyLoaded]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .scrolling-hover {
        background-color: rgba(147, 51, 234, 0.1) !important;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border-radius: 0.5rem;
        z-index: 10;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Fix search input focus
  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  useEffect(() => {
    if (isFocused && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isFocused, displayedTracks]);

  // Add search filtering effect
  useEffect(() => {
    if (!playlistTracks || !Array.isArray(playlistTracks)) return;
    
    if (!searchQuery.trim()) {
      setDisplayedTracks(sortTracks(playlistTracks, trackSortOrder));
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = playlistTracks.filter(track => {
      if (!track) return false;
      
      // Search in track name
      const nameMatch = track.name?.toLowerCase().includes(query);
      
      // Search in artist names
      const artistMatch = track.artists?.some(
        artist => artist.name?.toLowerCase().includes(query)
      );
      
      // Search in album name
      const albumMatch = track.album?.name?.toLowerCase().includes(query);
      
      return nameMatch || artistMatch || albumMatch;
    });
    
    setDisplayedTracks(sortTracks(filtered, trackSortOrder));
  }, [searchQuery, playlistTracks, trackSortOrder, sortTracks]);

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
      <div className="h-full w-full" ref={playlistContainerRef}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              height={height}
              width={width}
              itemCount={1 + displayedTracks.length}
              itemSize={getItemSize}
              overscanCount={10} // Increased for smoother scrolling
              onScroll={handleScroll}
              className="scrollbar-hide"
              style={{ position: 'relative' }}
            >
              {({ index, style }) => {
                if (index === 0) {
                  return (
                    <div className="w-full" style={{ ...style, position: 'absolute', left: 0, right: 0 }} data-index={index}>
                      <div className="container mx-auto px-12 py-8">
                        <PlaylistHeader
                          playlist={playlist}
                          onBack={onBack}
                          tracks={displayedTracks}
                          cachedStats={cachedStats.header}
                          isTransitioning={isPlaylistTransition}
                        />
                        
                        <PlaylistStats
                          playlist={playlist}
                          tracks={displayedTracks}
                          cachedStats={cachedStats.playlist}
                          className="mt-8"
                        />
                        
                        {/* Search and sort controls */}
                        <div className="flex items-center justify-between mb-6 mt-8">
                          <div className="relative flex-1 max-w-md">
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
                              onChange={handleSearchChange}
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
                      </div>
                    </div>
                  );
                }
                
                const trackIndex = index - 1;
                const track = displayedTracks[trackIndex];
                if (!track) return null;
                
                return (
                  <div className="w-full" style={{ ...style, position: 'absolute', left: 0, right: 0 }} data-index={index}>
                    <div className="container mx-auto px-12">
                      <TrackItem
                        key={`${track.id}-${trackIndex}`}
                        track={track}
                        onClick={() => onTrackSelect(track, displayedTracks)}
                        onAddToQueue={onAddToQueue}
                        isPlaying={isPlaying && currentTrack?.id === track.id}
                        index={trackIndex + 1}
                      />
                    </div>
                  </div>
                );
              }}
            </List>
          )}
        </AutoSizer>
        
        {/* Loading indicator */}
        {(isLoading || isBackgroundLoading) && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        )}
        
        {/* Scroll buttons */}
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
      </div>
    </motion.div>
  );
};

export default PlaylistView;
