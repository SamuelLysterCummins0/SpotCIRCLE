import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import PlaylistHeader from './PlaylistHeader';
import PlaylistStats from './PlaylistStats';
import TrackItem from '../tracks/TrackItem';
import { sortOptions } from '../../constants/sortOptions';

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
  
  const loadingTimeoutRef = useRef(null);
  const playlistContainerRef = useRef(null);
  const loadingRef = useRef(null);

  const loadPlaylistTracks = useCallback(async () => {
    if (!playlist) return;
    
    // Reset states when selecting a new playlist
    setPlaylistTracks([]);
    setPlaylistOffset(0);
    setPlaylistTotal(0);
    setHasMore(true);
    setIsLoadingMore(false);
    setTrackSortOrder('default');
    setShowSortDropdown(false);
    setDisplayedTracks([]);

    // Reset scroll position when switching playlists
    if (playlistContainerRef.current) {
      playlistContainerRef.current.scrollTop = 0;
    }
    
    try {
      const response = await axios.get(`/api/spotify/playlists/${playlist.id}/tracks`, {
        params: {
          offset: 0,
          limit: 50
        }
      });
      
      const { tracks, total, hasMore } = response.data;
      
      if (!Array.isArray(tracks)) {
        console.error('Expected tracks array but got:', typeof tracks);
        return;
      }

      setPlaylistTracks(tracks);
      setDisplayedTracks(tracks);
      setPlaylistTotal(total);
      setPlaylistOffset(tracks.length);
      setHasMore(hasMore);
      
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
      if (error.response?.status === 429 && !isRetrying) {
        setIsRetrying(true);
        const retryAfter = error.response.headers['retry-after'] || 3;
        loadingTimeoutRef.current = setTimeout(() => {
          setIsRetrying(false);
          loadPlaylistTracks();
        }, retryAfter * 1000);
      }
    }
  }, [playlist, isRetrying]);

  const sortTracks = useCallback((tracks, order) => {
    if (!tracks) return [];
    
    const tracksToSort = [...tracks];
    
    switch (order) {
      case 'reverse':
        return [...tracksToSort].reverse();
      case 'shuffle':
        return [...tracksToSort].sort(() => Math.random() - 0.5);
      case 'name':
        return [...tracksToSort].sort((a, b) => a.name.localeCompare(b.name));
      case 'artist':
        return [...tracksToSort].sort((a, b) => {
          const artistA = a.artists[0]?.name || '';
          const artistB = b.artists[0]?.name || '';
          return artistA.localeCompare(artistB);
        });
      case 'album':
        return [...tracksToSort].sort((a, b) => {
          const albumA = a.album?.name || '';
          const albumB = b.album?.name || '';
          return albumA.localeCompare(albumB);
        });
      case 'duration':
        return [...tracksToSort].sort((a, b) => a.duration_ms - b.duration_ms);
      default:
        return tracksToSort;
    }
  }, []);

  const loadMoreTracks = useCallback(async () => {
    if (!playlist || isLoadingMore || !hasMore || isRetrying) return;
    
    setIsLoadingMore(true);
    const scrollContainer = playlistContainerRef.current;
    const currentScrollPos = scrollContainer?.scrollTop || 0;

    try {
      const response = await axios.get(`/api/spotify/playlists/${playlist.id}/tracks`, {
        params: {
          offset: playlistOffset,
          limit: 50
        }
      });
      
      const { tracks, total, hasMore: moreAvailable } = response.data;
      
      if (!Array.isArray(tracks)) {
        console.error('Expected tracks array but got:', typeof tracks);
        return;
      }

      const validTracks = tracks.filter(track => 
        track && 
        track.name && 
        Array.isArray(track.artists) && 
        track.artists.length > 0 &&
        track.artists.every(artist => artist && artist.name)
      );

      // Update playlist tracks first
      setPlaylistTracks(prev => {
        const newTracks = [...prev, ...validTracks];
        return newTracks;
      });

      // Then update displayed tracks with proper sorting
      setDisplayedTracks(prev => {
        const allTracks = [...prev, ...validTracks];
        return sortTracks(allTracks, trackSortOrder);
      });
      
      setPlaylistTotal(total);
      setPlaylistOffset(prev => prev + tracks.length);
      setHasMore(moreAvailable);

      // Restore scroll position
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = currentScrollPos;
        }, 50);
      }

    } catch (error) {
      console.error('Error loading more tracks:', error);
      if (error.response?.status === 429 && !isRetrying) {
        setIsRetrying(true);
        const retryAfter = error.response.headers['retry-after'] || 3;
        loadingTimeoutRef.current = setTimeout(() => {
          setIsRetrying(false);
          loadMoreTracks();
        }, retryAfter * 1000);
      }
    } finally {
      if (!isRetrying) {
        setIsLoadingMore(false);
      }
    }
  }, [playlist, playlistOffset, isLoadingMore, hasMore, isRetrying, trackSortOrder, sortTracks]);

  const handleSortChange = useCallback((newOrder) => {
    setTrackSortOrder(newOrder);
    setDisplayedTracks(sortTracks(playlistTracks, newOrder));
  }, [playlistTracks, sortTracks]);

  useEffect(() => {
    loadPlaylistTracks();
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loadPlaylistTracks]);

  // Add intersection observer for infinite scroll
  useEffect(() => {
    if (!loadingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoadingMore && !isRetrying) {
          loadMoreTracks();
        }
      },
      { 
        root: null,
        rootMargin: '200px',
        threshold: 0.1 
      }
    );

    observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isRetrying, loadMoreTracks]);

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
        <div className="container mx-auto px-4 py-8">
          <PlaylistHeader
            playlist={playlist}
            onBack={onBack}
          />

          <PlaylistStats playlist={playlist} tracks={displayedTracks} />

          {/* Sort Controls */}
          <div className="flex justify-end px-4 mt-4">
            <div className="relative sort-dropdown">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="group relative px-4 py-2 overflow-hidden rounded-lg bg-gradient-to-br from-purple-900/40 to-black/40 hover:from-purple-800/40 hover:to-purple-900/40 transition-colors duration-300"
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
    </motion.div>
  );
};

export default PlaylistView;
