import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef 
} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import PlayerNotch from '../components/PlayerNotch';
import SpotifyPlayer from '../components/SpotifyPlayer';
import axios from 'axios';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { usePlayerContext } from '../contexts/PlayerContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const TimeRanges = {
  SHORT: 'short_term',     // Last 4 weeks
  MEDIUM: 'medium_term',   // Last 6 months
  LONG: 'long_term'       // All time/Lifetime
};

const TimeRangeLabels = {
  short_term: 'Last 4 Weeks',
  medium_term: 'Last 6 Months', 
  long_term: 'Last Year'
};

const timeRanges = [
  { id: TimeRanges.SHORT, label: TimeRangeLabels.short_term },
  { id: TimeRanges.MEDIUM, label: TimeRangeLabels.medium_term },
  { id: TimeRanges.LONG, label: TimeRangeLabels.long_term }
];

const decodeHtmlEntities = (str) => {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = str;
  return textArea.value;
};

const Home = () => {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(TimeRanges.SHORT);
  const [expandedSection, setExpandedSection] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const { currentTrack, updateCurrentTrack, setIsPlaying: setPlayerIsPlaying } = usePlayerContext();
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [showPlaylistView, setShowPlaylistView] = useState(false);
  const [animatingPlaylist, setAnimatingPlaylist] = useState(null);
  const [isPlaylistTransition, setIsPlaylistTransition] = useState(false);
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const { scrollY } = useScroll();
  const [currentPage, setCurrentPage] = useState(0);
  const TRACKS_PER_PAGE = 100;

  // Cache track data to prevent unnecessary re-fetches
  const trackCache = useRef(new Map());
  const albumCache = useRef(new Map());

  // Memoize album processing
  const processTopAlbums = useCallback((tracks) => {
    if (!tracks || !Array.isArray(tracks)) return [];
    
    const albumsMap = new Map();
    tracks.forEach(track => {
      if (!track?.album?.id) return;
      
      const albumId = track.album.id;
      const cachedAlbum = albumCache.current.get(albumId);
      
      if (cachedAlbum) {
        albumsMap.set(albumId, {
          ...cachedAlbum,
          playCount: (albumsMap.get(albumId)?.playCount || 0) + 1
        });
      } else {
        const albumData = {
          ...track.album,
          playCount: 1,
          artists: track.artists
        };
        albumCache.current.set(albumId, albumData);
        albumsMap.set(albumId, albumData);
      }
    });

    return Array.from(albumsMap.values())
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 14);
  }, []);

  // Optimize track data fetching
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check cache first
      const cacheKey = `${selectedTimeRange}_data`;
      const cachedData = trackCache.current.get(cacheKey);
      
      if (cachedData) {
        const { tracks, artists, timestamp } = cachedData;
        const now = Date.now();
        // Use cache if it's less than 5 minutes old
        if (now - timestamp < 5 * 60 * 1000) {
          setTopTracks(tracks);
          setTopArtists(artists);
          setTopAlbums(processTopAlbums(tracks));
          setLoading(false);
          return;
        }
      }
      
      // Fetch fresh data if cache is stale or missing
      const [topTracksData, topArtistsData] = await Promise.all([
        fetchData(`/api/tracks/top?time_range=${selectedTimeRange}&limit=28`),
        fetchData(`/api/artists/top?time_range=${selectedTimeRange}&limit=21`)
      ]);

      if (topTracksData && Array.isArray(topTracksData)) {
        setTopTracks(topTracksData);
        const processedAlbums = processTopAlbums(topTracksData);
        setTopAlbums(processedAlbums);
        
        // Update cache
        trackCache.current.set(cacheKey, {
          tracks: topTracksData,
          artists: topArtistsData,
          timestamp: Date.now()
        });
      }
      
      if (topArtistsData && Array.isArray(topArtistsData)) {
        setTopArtists(topArtistsData);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load music data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedTimeRange, processTopAlbums]);

  // Clean up caches when component unmounts
  useEffect(() => {
    return () => {
      trackCache.current.clear();
      albumCache.current.clear();
    };
  }, []);

  // Parallax effect values
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 200], [1, 0]);

  const refreshAccessToken = async () => {
    try {
      const refresh_token = localStorage.getItem('spotify_refresh_token');
      if (!refresh_token) {
        throw new Error('No refresh token available');
      }

      const response = await api.post('/api/auth/refresh', {
        refresh_token
      });

      localStorage.setItem('spotify_access_token', response.data.access_token);
      return response.data.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      handleLogout();
      throw error;
    }
  };

  const fetchData = async (endpoint, retryWithNewToken = true) => {
    try {
      const token = localStorage.getItem('spotify_access_token');
      if (!token) {
        throw new Error('No access token available');
      }

      const response = await api.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (err) {
      if (err.response?.status === 401 && retryWithNewToken) {
        try {
          await refreshAccessToken();
          return fetchData(endpoint, false);
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
          handleLogout();
        }
      }
      throw err;
    }
  };

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const response = await api.get('/api/spotify/playlists', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('spotify_access_token')}`
          }
        });
        console.log('Playlists response:', response.data);  // Debug log
        setPlaylists(response.data);
      } catch (error) {
        console.error('Error fetching playlists:', error.response || error);
      }
    };

    fetchPlaylists();
  }, []);

  useEffect(() => {
    const loadPlaylistTracks = async () => {
      if (!selectedPlaylist) return;
      
      try {
        const response = await axios.get(`/api/spotify/playlists/${selectedPlaylist.id}/tracks`);
        const tracks = response.data;
        
        if (!Array.isArray(tracks)) {
          console.error('Expected tracks array but got:', typeof tracks);
          setPlaylistTracks([]);
          return;
        }

        // Additional safety check for track properties
        const validTracks = tracks.filter(track => 
          track && 
          track.uri && 
          track.name && 
          track.artists && 
          Array.isArray(track.artists) && 
          track.album && 
          track.album.images && 
          Array.isArray(track.album.images)
        );

        console.log(`Loaded ${validTracks.length} valid tracks from playlist`);
        setPlaylistTracks(validTracks);
      } catch (error) {
        console.error('Error loading playlist tracks:', error);
        setPlaylistTracks([]);
      }
    };
  
    loadPlaylistTracks();
  }, [selectedPlaylist]);

  useEffect(() => {
    const token = localStorage.getItem('spotify_access_token');
    if (!token) {
      navigate('/');
      return;
    }
    fetchAllData();
  }, [navigate, fetchAllData]); // Re-fetch when time range changes

  useEffect(() => {
    const getDevices = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/spotify/player/devices`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
          }
        });
        const devices = response.data.devices;
        if (devices && devices.length > 0) {
          setDeviceId(devices[0].id);
        }
      } catch (error) {
        console.error('Error getting devices:', error);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    axios.defaults.baseURL = 'http://localhost:5001';
    axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('spotify_access_token')}`;
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    navigate('/');
  };

  const getPlaylistStats = () => {
    if (!selectedPlaylist || !playlistTracks || playlistTracks.length === 0) {
      return { duration: '0 min', trackCount: 0, lastUpdated: 'Never' };
    }
  
    try {
      // Calculate total duration - safely handle null/undefined tracks
      const totalDuration = playlistTracks.reduce((sum, track) => {
        if (!track || typeof track !== 'object') return sum;
        return sum + (track.duration_ms || 0);
      }, 0);
      
      // Format duration in hours, minutes, and seconds
      const hours = Math.floor(totalDuration / (1000 * 60 * 60));
      const minutes = Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((totalDuration % (1000 * 60)) / 1000);
      
      let duration;
      if (hours > 0) {
        duration = `${hours} hr ${minutes} min`;
      } else if (minutes > 0) {
        duration = `${minutes} min ${seconds} sec`;
      } else {
        duration = `${seconds} sec`;
      }
  
      // Get track count
      const trackCount = playlistTracks.length;
  
      // Format last updated date - safely handle missing data
      let lastUpdated = 'Recently';
      if (selectedPlaylist.tracks?.items?.[0]?.added_at) {
        try {
          const date = new Date(selectedPlaylist.tracks.items[0].added_at);
          const now = new Date();
          const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
          
          if (diffInDays === 0) {
            const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
            if (diffInHours === 0) {
              const diffInMinutes = Math.floor((now - date) / (1000 * 60));
              lastUpdated = `${diffInMinutes} minutes ago`;
            } else {
              lastUpdated = `${diffInHours} hours ago`;
            }
          } else if (diffInDays === 1) {
            lastUpdated = 'Yesterday';
          } else if (diffInDays < 7) {
            lastUpdated = `${diffInDays} days ago`;
          } else {
            lastUpdated = date.toLocaleDateString(undefined, { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
          }
        } catch (e) {
          console.warn('Error formatting date:', e);
        }
      }
  
      return {
        duration,
        trackCount,
        lastUpdated
      };
    } catch (error) {
      console.error('Error calculating playlist stats:', error);
      return { duration: '0 min', trackCount: 0, lastUpdated: 'Recently' };
    }
  };

  const handleAddToQueue = async (track, event) => {
    event.stopPropagation(); // Prevent track selection when clicking queue button
    try {
      const deviceId = window.spotifyWebPlaybackDeviceId;
      if (!deviceId) {
        throw new Error("No playback device found. Please refresh the page.");
      }

      // Add track to local queue state
      setQueue(prevQueue => [...prevQueue, track]);

      // Add track to Spotify queue
      await api.post('/api/spotify/player/queue', {
        uri: track.uri,
        deviceId
      });

      // Show success toast notification
      toast.custom((t) => (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.6 }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            scale: 1,
            transition: { 
              type: "spring",
              stiffness: 200,
              damping: 20
            }
          }}
          exit={{ 
            y: 100, 
            opacity: 0, 
            scale: 0.6,
            transition: {
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 1
            }
          }}
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-gradient-to-r from-purple-900/90 to-purple-600/90 backdrop-blur-lg shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 transform-gpu`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 pt-0.5">
                <motion.img
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: 1, 
                    opacity: 1,
                    transition: {
                      delay: 0.1,
                      duration: 0.2
                    }
                  }}
                  exit={{ 
                    scale: 0.8, 
                    opacity: 0,
                    transition: {
                      duration: 0.15
                    }
                  }}
                  className="h-10 w-10 rounded-lg"
                  src={track.album?.images[0]?.url}
                  alt=""
                />
              </div>
              <div className="ml-3 flex-1">
                <motion.p 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ 
                    x: 0, 
                    opacity: 1,
                    transition: {
                      delay: 0.15,
                      duration: 0.3
                    }
                  }}
                  exit={{ 
                    x: -20, 
                    opacity: 0,
                    transition: {
                      duration: 0.2
                    }
                  }}
                  className="text-sm font-medium text-white"
                >
                  {track.name}
                </motion.p>
                <motion.p 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ 
                    x: 0, 
                    opacity: 1,
                    transition: {
                      delay: 0.2,
                      duration: 0.3
                    }
                  }}
                  exit={{ 
                    x: -20, 
                    opacity: 0,
                    transition: {
                      duration: 0.15
                    }
                  }}
                  className="mt-1 text-sm text-purple-200"
                >
                  Added to queue
                </motion.p>
              </div>
            </div>
          </div>
          <div className="flex">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-purple-300 hover:text-purple-200 focus:outline-none"
            >
              <motion.svg 
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ 
                  rotate: 0, 
                  opacity: 1,
                  transition: {
                    delay: 0.25,
                    duration: 0.3,
                    type: "spring",
                    stiffness: 300
                  }
                }}
                exit={{ 
                  rotate: 90, 
                  opacity: 0,
                  transition: {
                    duration: 0.2
                  }
                }}
                className="h-5 w-5" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                  clipRule="evenodd" 
                />
              </motion.svg>
            </motion.button>
          </div>
        </motion.div>
      ), {
        duration: 2000,
        position: 'bottom-center',
      });

    } catch (error) {
      console.error("Error adding to queue:", error);
      toast.error(`Failed to add track to queue: ${error.response?.data?.error || 'Unknown error'}`, {
        style: {
          background: '#4B0082',
          color: '#fff',
        },
      });
    }
  };

  const handleTrackSelect = async (track, trackList = null) => {
    console.log("Selected Track:", track);
    
    try {
      const deviceId = window.spotifyWebPlaybackDeviceId;
      console.log("Using device ID:", deviceId);

      if (!deviceId) {
        throw new Error("No playback device found. Please refresh the page.");
      }

      // If clicking the same track that's currently playing, toggle play/pause
      if (currentTrack?.id === track.id) {
        if (isPlaying) {
          await axios.put('/api/spotify/player/pause', { device_id: deviceId });
          setIsPlaying(false);
          setPlayerIsPlaying(false);
        } else {
          await axios.put('/api/spotify/player/play', { device_id: deviceId });
          setIsPlaying(true);
          setPlayerIsPlaying(true);
        }
        return;
      }

      // If not playing from playlist or track not found in playlist, fallback to track URI
      const currentTracks = trackList || topTracks;
      if (!currentTracks || !Array.isArray(currentTracks)) {
        throw new Error("No valid track list available");
      }

      const startIndex = currentTracks.findIndex(t => t && t.id === track.id);
      if (startIndex === -1) {
        throw new Error("Selected track not found in track list");
      }

      // Create a queue starting from the selected track
      const trackQueue = [
        ...currentTracks.slice(startIndex),
        ...currentTracks.slice(0, startIndex)
      ].filter(track => 
        track && track.uri && 
        !track.uri.includes('spotify:local') && 
        track.uri.startsWith('spotify:track:')
      );

      if (trackQueue.length === 0) {
        throw new Error("No playable tracks found in queue");
      }

      // Get track URIs
      const trackUris = trackQueue.map(t => t.uri);

      // Start playback with track URIs
      await axios.put('/api/spotify/player/play', {
        device_id: deviceId,
        uris: trackUris
      });

      setQueue(trackQueue.slice(1));
      updateCurrentTrack(trackQueue[0]);
      setIsPlaying(true);
      setPlayerIsPlaying(true);

    } catch (error) {
      console.error("Error playing track:", error);
      if (error.response?.data?.error) {
        toast.error(`Error: ${error.response.data.error}`, {
          style: {
            background: '#4B0082',
            color: '#fff',
          },
        });
      } else {
        toast.error(`Error: ${error.message || 'Failed to play track'}`, {
          style: {
            background: '#4B0082',
            color: '#fff',
          },
        });
      }
    }
  };

  const handlePlayPause = async () => {
    try {
      if (!currentTrack) return;
      
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error("Error toggling playback:", error);
    }
  };

  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const debouncedUpdateState = useCallback(
    debounce(async () => {
      try {
        const response = await axios.get('/api/spotify/player/state');
        if (response.data?.item && response.data.item.id !== currentTrack?.id) {
          updateCurrentTrack(response.data.item);
          if (response.data?.queue) {
            setQueue(prevQueue => {
              // Only update if queue has actually changed
              const newQueue = response.data.queue;
              if (prevQueue.length !== newQueue.length || 
                  JSON.stringify(prevQueue) !== JSON.stringify(newQueue)) {
                return newQueue;
              }
              return prevQueue;
            });
          }
        }
      } catch (error) {
        console.debug('State update failed:', error);
      }
    }, 300),
    [currentTrack]
  );

  useEffect(() => {
    if (!isPlaying) return;

    // Initial update
    debouncedUpdateState();

    // Update every 2 seconds while playing
    const interval = setInterval(debouncedUpdateState, 2000);
    return () => {
      clearInterval(interval);
      debouncedUpdateState.cancel?.();
    };
  }, [isPlaying, debouncedUpdateState]);

  const updatePlayerState = useCallback(async () => {
    try {
      const response = await axios.get('/api/spotify/player/state');
      if (response.data?.item && response.data.item.id !== currentTrack?.id) {
        updateCurrentTrack(response.data.item);
        if (response.data?.queue) {
          setQueue(prevQueue => {
            // Only update if queue has actually changed
            const areQueuesEqual = prevQueue.length === response.data.queue.length &&
              prevQueue.every((track, index) => track.id === response.data.queue[index].id);
            return areQueuesEqual ? prevQueue : response.data.queue;
          });
        }
      }
      setIsPlaying(!response.data?.is_paused);
      setPlayerIsPlaying(!response.data?.is_paused);
    } catch (error) {
      console.error('Failed to update player state:', error);
    }
  }, [currentTrack?.id, updateCurrentTrack, setPlayerIsPlaying]);

  const handleNext = async () => {
    try {
      // Make API call first
      await axios.post('/api/spotify/player/next');
      
      // Wait a tiny bit for Spotify to update its state
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Then update the UI with the actual state
      await updatePlayerState();
    } catch (error) {
      console.error('Failed to skip to next track:', error);
      updatePlayerState();
    }
  };

  const handlePrevious = async () => {
    try {
      await axios.post('/api/spotify/player/previous', {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
        }
      });

      // Small delay before getting actual state
      await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms to 50ms
      await debouncedUpdateState();
    } catch (error) {
      console.error('Error going to previous track:', error);
      debouncedUpdateState();
    }
  };

  const handlePlaylistSelect = (playlist) => {
    if (selectedPlaylist?.id === playlist.id) return;
    
    if (showPlaylistView) {
      // Playlist to playlist transition
      setIsPlaylistTransition(true);
      setTimeout(() => {
        setSelectedPlaylist(playlist);
        setIsPlaylistTransition(false);
      }, 300);
    } else {
      // Main page to playlist transition
      setSelectedPlaylist(playlist);
      setShowPlaylistView(true);
    }
  };

  const handleBackToMain = () => {
    setShowPlaylistView(false);
    setTimeout(() => {
      setSelectedPlaylist(null);
    }, 300);
  };

  const renderMainContent = () => (
    <motion.div 
      initial={false}
      animate={{ x: showPlaylistView ? "-100%" : 0, opacity: showPlaylistView ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-full"
    >
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-purple-400">
          SpotCIRCLE
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 
                   text-purple-400 hover:text-purple-300 transition-all duration-300 
                   border border-purple-500/20 backdrop-blur-sm"
        >
          Logout
        </button>
      </div>

      {/* Tracks List */}
      <div className="space-y-8">
        {renderTrackList(topTracks, 'Top tracks')}
        {renderArtistList(topArtists, 'Top artists')}
        {renderAlbumList(topAlbums, 'Top albums')}
      </div>
    </motion.div>
  );

 const renderPlaylistView = () => {
  const { duration, trackCount, lastUpdated } = getPlaylistStats();
  
  return (
    <motion.div
      key={selectedPlaylist?.id}
      initial={isPlaylistTransition ? { x: "100%" } : { x: "100%", opacity: 0 }}
      animate={isPlaylistTransition ? { x: 0 } : { x: showPlaylistView ? 0 : "100%", opacity: showPlaylistView ? 1 : 0 }}
      exit={isPlaylistTransition ? { x: "-100%" } : { x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute inset-0 w-full overflow-y-auto"
    >
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button 
            onClick={handleBackToMain} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex flex-col items-start w-full">
            <div className="relative flex flex-col w-full">
              <h1 className="text-3xl font-bold text-white mb-8 pl-4">{selectedPlaylist?.name}</h1>
              <div className="relative mb-10 group w-full px-4">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 to-purple-900/20 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative w-full h-52 rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/40 to-black/40 p-6">
                  {/* Decorative circles */}
                  <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2"></div>
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-600/10 rounded-full blur-2xl transform translate-x-1/4 translate-y-1/4"></div>
                  
                  {/* Content container */}
                  <div className="flex items-center justify-between h-full">
                    {/* Left side info */}
                    <div className="w-1/4 text-white/80 space-y-4">
                      <div className="space-y-1">
                        <div className="text-sm uppercase tracking-wider text-purple-300/70">Created by</div>
                        <div className="font-medium text-base truncate drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{selectedPlaylist?.owner?.display_name}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm uppercase tracking-wider text-purple-300/70">Followers</div>
                        <div className="font-medium text-base drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{selectedPlaylist?.followers?.total || 0}</div>
                      </div>
                    </div>

                    {/* Left decorative element */}
                    <div className="relative w-24 h-full">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[1px] h-24 bg-gradient-to-b from-transparent via-purple-500/30 to-transparent"></div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/5 to-purple-600/5 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-purple-400/40"></div>
                        </div>
                      </div>
                    </div>

                    {/* Center - Album cover with glow */}
                    <div className="relative w-39 h-40 -ml-12">
                      {/* Glow effects */}
                      <div className="absolute inset-0 bg-purple-500/10 rounded-lg blur-xl"></div>
                      <div className="absolute inset-0 bg-purple-600/5 rounded-lg blur-md"></div>
                      {/* Backdrop */}
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-black/40 rounded-lg backdrop-blur-sm"></div>
                      <img 
                        src={selectedPlaylist?.images?.[0]?.url} 
                        alt={selectedPlaylist?.name}
                        className="relative w-full h-full object-contain rounded-lg shadow-xl"
                      />
                      {/* Additional glow overlay */}
                      <div className="absolute inset-0 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.15)] pointer-events-none"></div>
                    </div>

                    {/* Right decorative element */}
                    <div className="relative w-24 h-full">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[1px] h-24 bg-gradient-to-b from-transparent via-purple-500/30 to-transparent"></div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/5 to-purple-600/5 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-purple-400/40"></div>
                        </div>
                      </div>
                    </div>

                    {/* Right side info */}
                    <div className="w-1/4 text-right text-white/80 space-y-4">
                      <div className="space-y-1">
                        <div className="text-sm uppercase tracking-wider text-purple-300/70">Playlist Type</div>
                        <div className="font-medium text-base capitalize drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{selectedPlaylist?.public ? 'Public' : 'Private'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm uppercase tracking-wider text-purple-300/70">Description</div>
                        <div className="font-medium text-base break-words drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{decodeHtmlEntities(selectedPlaylist?.description) || 'No description'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between w-full relative -mt-4 px-4">
          <div className="group relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-gradient-to-b from-purple-500/50 to-transparent"></div>
            <div className="flex flex-col items-center pt-10 px-4">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
                <svg className="w-5 h-5 text-purple-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-purple-300 font-medium mt-2 text-lg drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{duration}</span>
              <span className="text-xs uppercase tracking-widest text-purple-400/70 mt-1">Duration</span>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[2px] h-12 bg-gradient-to-b from-purple-500/50 to-transparent"></div>
            <div className="flex flex-col items-center pt-14 px-4">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
                <svg className="w-5 h-5 text-purple-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              </div>
              <span className="text-purple-300 font-medium mt-2 text-lg drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{trackCount}</span>
              <span className="text-xs uppercase tracking-widest text-purple-400/70 mt-1">Tracks</span>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-gradient-to-b from-purple-500/50 to-transparent"></div>
            <div className="flex flex-col items-center pt-10 px-4">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
                <svg className="w-5 h-5 text-purple-400 relative transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-purple-300 font-medium mt-2 text-lg drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{lastUpdated}</span>
              <span className="text-xs uppercase tracking-widest text-purple-400/70 mt-1">Last Updated</span>
            </div>
          </div>
        </div>
        <div className="w-full h-[2px] mt-4 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>

        {/* Tracks List */}
        <div className="space-y-2 pb-24">
          {playlistTracks.map((track, index) => (
            <TrackItem 
              key={`${track.id}-${index}`}
              track={track}
              onClick={() => handleTrackSelect(track, playlistTracks)}
              isPlaying={isPlaying && currentTrack?.id === track.id}
              index={index + 1}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

  const renderTrackList = (tracks, title) => {
    const isExpanded = expandedSection === 'tracks';
    // Show only first 7 when not expanded
    const displayTracks = tracks.slice(0, 7);
    // Show tracks 8-28 when expanded
    const hiddenTracks = isExpanded ? tracks.slice(7, 28) : [];

    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-purple-400">Your top tracks from {TimeRangeLabels[selectedTimeRange].toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowTimeRangeDropdown(!showTimeRangeDropdown)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 
                         text-purple-400 hover:text-purple-300 transition-colors"
              >
                <span>{TimeRangeLabels[selectedTimeRange]}</span>
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  animate={{ rotate: showTimeRangeDropdown ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                >
                  <path d="M6 9l6 6 6-6"/>
                </motion.svg>
              </button>
              <AnimatePresence>
                {showTimeRangeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-0 mt-2 py-2 w-48 bg-black/90 backdrop-blur-lg rounded-xl shadow-xl border border-white/10 z-50"
                  >
                    {Object.entries(TimeRanges).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedTimeRange(value);
                          setShowTimeRangeDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-white/10 transition-colors ${
                          selectedTimeRange === value ? 'text-purple-400' : 'text-white'
                        }`}
                      >
                        {TimeRangeLabels[value]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <motion.button
              onClick={() => setExpandedSection(isExpanded ? null : 'tracks')}
              className="p-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 
                       text-purple-400 hover:text-purple-300 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
              >
                <path d="M6 9l6 6 6-6"/>
              </motion.svg>
            </motion.button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {displayTracks.map((track, index) => (
            <div key={track.id}>
              <MainPageTrackItem
                track={track}
                index={index + 1}
                onClick={() => handleTrackSelect(track, tracks)}
              />
            </div>
          ))}
          <AnimatePresence>
            {isExpanded && hiddenTracks.map((track, index) => (
              <motion.div
                key={`${track.id}-${index}`}
                initial={{ 
                  opacity: 0,
                  scale: 0.6,
                  y: 20
                }}
                animate={{ 
                  opacity: 1,
                  scale: 1,
                  y: 0
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut"
                }}
              >
                <MainPageTrackItem
                  track={track}
                  index={index + 8}
                  onClick={() => handleTrackSelect(track, tracks)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const renderArtistList = (artists, title) => {
    const isExpanded = expandedSection === 'artists';
    // Show only first 7 when not expanded
    const displayArtists = artists.slice(0, 7);
    // Show artists 8-21 when expanded
    const hiddenArtists = isExpanded ? artists.slice(7, 21) : [];

    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-purple-400">Your top artists from {TimeRangeLabels[selectedTimeRange].toLowerCase()}</p>
          </div>
          <motion.button
            onClick={() => setExpandedSection(isExpanded ? null : 'artists')}
            className="p-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 
                     text-purple-400 hover:text-purple-300 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              <path d="M6 9l6 6 6-6"/>
            </motion.svg>
          </motion.button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {displayArtists.map((artist, index) => (
            <div key={artist.id} className="group">
              <ArtistItem artist={artist} index={index + 1} />
            </div>
          ))}
          <AnimatePresence>
            {isExpanded && hiddenArtists.map((artist, index) => (
              <motion.div
                key={`${artist.id}-${index}`}
                initial={{ 
                  opacity: 0,
                  scale: 0.6,
                  y: 20
                }}
                animate={{ 
                  opacity: 1,
                  scale: 1,
                  y: 0
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut"
                }}
                className="group"
              >
                <ArtistItem artist={artist} index={index + 8} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const renderAlbumList = (albums, title) => {
    const isExpanded = expandedSection === 'albums';
    // Show only first 7 when not expanded
    const displayAlbums = albums.slice(0, 7);
    // Show albums 8-14 when expanded
    const hiddenAlbums = isExpanded ? albums.slice(7, 14) : [];

    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-purple-400">Your top albums from {TimeRangeLabels[selectedTimeRange].toLowerCase()}</p>
          </div>
          <motion.button
            onClick={() => setExpandedSection(isExpanded ? null : 'albums')}
            className="p-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 
                     text-purple-400 hover:text-purple-300 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              <path d="M6 9l6 6 6-6"/>
            </motion.svg>
          </motion.button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {displayAlbums.map((album, index) => (
            <div key={album.id} className="group">
              <AlbumItem album={album} index={index + 1} />
            </div>
          ))}
          <AnimatePresence>
            {isExpanded && hiddenAlbums.map((album, index) => (
              <motion.div
                key={`${album.id}-${index}`}
                initial={{ 
                  opacity: 0,
                  scale: 0.6,
                  y: 20
                }}
                animate={{ 
                  opacity: 1,
                  scale: 1,
                  y: 0
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut"
                }}
                className="group"
              >
                <AlbumItem album={album} index={index + 8} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const ArtistItem = ({ artist, index }) => (
    <motion.div
      className="group relative"
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="relative aspect-square">
        <img
          src={artist.images[0]?.url}
          alt={artist.name}
          className="w-full h-full object-cover rounded-full shadow-lg transition-all duration-300 group-hover:shadow-xl"
        />
        <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        </div>
      </div>
      <motion.div 
        className="mt-2 text-center"
        initial={{ opacity: 0.8 }}
        whileHover={{ opacity: 1 }}
      >
        <h3 className="font-medium truncate text-white group-hover:text-white/90 transition-colors">{index}. {artist.name}</h3>
      </motion.div>
    </motion.div>
  );

  const AlbumItem = ({ album, index }) => (
    <motion.div
      className="group relative"
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="relative aspect-square">
        <img
          src={album.images[0]?.url}
          alt={album.name}
          className="w-full h-full object-cover rounded-lg shadow-lg transition-all duration-300 group-hover:shadow-xl"
        />
        <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        </div>
      </div>
      <motion.div 
        className="mt-2"
        initial={{ opacity: 0.8 }}
        whileHover={{ opacity: 1 }}
      >
        <h3 className="font-medium truncate text-white group-hover:text-white/90 transition-colors">{index}. {album.name}</h3>
        <p className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors">
          {album.artists?.map(a => a.name).join(', ')}
        </p>
      </motion.div>
    </motion.div>
  );

  const TrackItem = ({ track, onClick, isPlaying, index }) => {
    const [isQueueAnimating, setIsQueueAnimating] = useState(false);

    const handleQueueClick = (e) => {
      e.stopPropagation();
      setIsQueueAnimating(true);
      handleAddToQueue(track, e);
      setTimeout(() => setIsQueueAnimating(false), 1000);
    };

    return (
      <motion.div
        className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors relative"
        onClick={onClick}
        whileHover={{ x: 4 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <div className="w-12 h-12 relative flex-shrink-0">
          <img
            src={track.album?.images[0]?.url}
            alt={track.name}
            className="w-full h-full object-cover rounded-md shadow-lg transition-all duration-300 group-hover:shadow-xl"
          />
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button className="p-2 bg-[#5B21B6] rounded-full hover:scale-105 transition-transform">
              {isPlaying ? (
                <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" fill="white" />
                  <rect x="14" y="4" width="4" height="16" fill="white" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <motion.h3 
            className="font-medium truncate text-white group-hover:text-white/90 transition-colors"
            initial={{ opacity: 0.9 }}
            whileHover={{ opacity: 1 }}
          >
            {index}. {track.name}
          </motion.h3>
          <motion.p 
            className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors"
            initial={{ opacity: 0.7 }}
            whileHover={{ opacity: 1 }}
          >
            {track.artists.map(a => a.name).join(', ')}
          </motion.p>
        </div>
        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsQueueAnimating(true);
              handleAddToQueue(track, e);
              setTimeout(() => setIsQueueAnimating(false), 1000);
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </motion.button>
        </div>
      </motion.div>
    );
  };

  const MainPageTrackItem = ({ track, index, onClick }) => (
    <motion.div
      key={track.id}
      className="group relative"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="relative aspect-square">
        <img
          src={track.album?.images[0]?.url}
          alt={track.name}
          className="w-full h-full object-cover rounded-lg shadow-lg transition-all duration-300 group-hover:shadow-xl"
        />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button className="p-3 bg-[#5B21B6] rounded-full hover:scale-105 transition-transform">
            {currentTrack?.id === track.id && isPlaying ? (
              <svg className="w-6 h-6" fill="white" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" fill="white" />
                <rect x="14" y="4" width="4" height="16" fill="white" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="white" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <motion.div 
        className="mt-2"
        initial={{ opacity: 0.8 }}
        whileHover={{ opacity: 1 }}
      >
        <h3 className="font-medium truncate text-white group-hover:text-white/90 transition-colors">{index}. {track.name}</h3>
        <p className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors">
          {track.artists.map(a => a.name).join(', ')}
        </p>
      </motion.div>
    </motion.div>
  );

  const PlaylistItem = ({ playlist, onClick, isSelected }) => (
    <button
      key={playlist.id}
      onClick={onClick}
      className={`group relative w-36 h-12 rounded-xl overflow-hidden transition-all hover:scale-105 ${
        isSelected 
          ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-black' 
          : ''
      }`}
      title={playlist.name}
    >
      <div className="absolute inset-0 flex items-center">
        <div className="relative w-12 h-12">
          <img 
            src={playlist.images[0]?.url || '/default-playlist.png'} 
            alt=""
            className="w-12 h-12 object-cover"
          />
        </div>
        <div className="flex-1 px-2 text-left truncate">
          <p className="text-xs font-medium text-white truncate">{playlist.name}</p>
          <p className="text-[10px] text-gray-400 truncate">
            {playlist.tracks?.total || 0} tracks
          </p>
        </div>
      </div>
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading your music...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E1E1E] to-[#121212] text-white pb-24">
      <Toaster />
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden bg-black">
        {/* Base dark layer */}
        <div className="absolute inset-0 bg-black opacity-90" />

        {/* Animated gradients */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Center black hole effect */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%]">
            <div className="w-full h-full" style={{
              background: 'radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.95) 30%, rgba(0, 0, 0, 0.98) 50%)'
            }} />
          </div>

          {/* Moving gradients - Center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] moving-gradient">
            <div className="w-full h-full" style={{
              background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.6) 0%, rgba(88, 28, 135, 0.2) 20%, transparent 40%)'
            }} />
          </div>

          {/* Moving gradients - Left */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[200%] h-[200%] moving-gradient-slow" style={{ animationDelay: '-2s' }}>
            <div className="w-full h-full" style={{
              background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.2) 25%, transparent 45%)'
            }} />
          </div>

          {/* Moving gradients - Right */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[200%] h-[200%] moving-gradient" style={{ animationDelay: '-4s' }}>
            <div className="w-full h-full" style={{
              background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.2) 25%, transparent 45%)'
            }} />
          </div>

          {/* Moving gradients - Top */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[200%] h-[200%] moving-gradient-fast" style={{ animationDelay: '-3s' }}>
            <div className="w-full h-full" style={{
              background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.2) 25%, transparent 45%)'
            }} />
          </div>

          {/* Moving gradients - Bottom */}
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[200%] h-[200%] moving-gradient-slow" style={{ animationDelay: '-5s' }}>
            <div className="w-full h-full" style={{
              background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.2) 25%, transparent 45%)'
            }} />
          </div>

          {/* Additional floating gradients */}
          <div className="absolute left-1/4 top-1/4 w-[150%] h-[150%] moving-gradient" style={{ animationDelay: '-1s' }}>
            <div className="w-full h-full" style={{
              background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.25) 20%, transparent 40%)'
            }} />
          </div>

          <div className="absolute right-1/4 bottom-1/4 w-[150%] h-[150%] moving-gradient-fast" style={{ animationDelay: '-6s' }}>
            <div className="w-full h-full" style={{
              background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.25) 20%, transparent 40%)'
            }} />
          </div>
        </div>

        {/* Dark overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black opacity-80" />
        <div className="absolute inset-0 bg-black opacity-40" />
      </div>

      {/* Content */}
      <div className="relative">
        <SpotifyPlayer
          uri={currentTrack?.uri}
          isPlaying={isPlaying}
          onPlayPause={setIsPlaying}
        />
        <div className="flex">
          {/* Playlist Sidebar */}
          <div className="fixed left-8 top-1/2 -translate-y-1/2 z-50">
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/5">
              <div 
                className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto px-2 pb-2 pt-2 -mx-2 -mb-2 -mt-2"
              >
                {playlists.map((playlist, index) => (
                  <PlaylistItem
                    key={`${playlist.id}-${index}`}
                    playlist={playlist}
                    onClick={() => handlePlaylistSelect(playlist)}
                    isSelected={selectedPlaylist?.id === playlist.id}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 pl-20">
            <div className="container mx-auto px-4 py-8 relative overflow-hidden">
              {renderMainContent()}
              {renderPlaylistView()}
            </div>
          </div>
        </div>
      </div>

      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <PlayerNotch
            track={currentTrack}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        </div>
      )}
    </div>
  );
};

export default Home;
