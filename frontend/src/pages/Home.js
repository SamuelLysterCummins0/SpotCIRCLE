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

const Home = () => {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(TimeRanges.SHORT);
  const [hoveredTrack, setHoveredTrack] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [showPlaylistView, setShowPlaylistView] = useState(false);
  const [animatingPlaylist, setAnimatingPlaylist] = useState(null);
  const [isPlaylistTransition, setIsPlaylistTransition] = useState(false);
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const { scrollY } = useScroll();
  const [currentPage, setCurrentPage] = useState(0);
  const TRACKS_PER_PAGE = 100;

  
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

  

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching data with time range:', selectedTimeRange);
      
      // Fetch tracks and artists with their respective limits
      const [topTracksData, topArtistsData] = await Promise.all([
        fetchData(`/api/tracks/top?time_range=${selectedTimeRange}&limit=28`),
        fetchData(`/api/artists/top?time_range=${selectedTimeRange}&limit=21`)
      ]);
  
      if (topTracksData) {
        console.log('Received tracks:', topTracksData.length);
        setTopTracks(topTracksData);
      }
      
      if (topArtistsData) {
        console.log('Received artists:', topArtistsData.length);
        setTopArtists(topArtistsData);
      }
  
      // Generate top albums from the tracks (limited to 14)
      const albumsMap = new Map();
      if (topTracksData) {
        topTracksData.forEach(track => {
          if (track.album) {
            const albumId = track.album.id;
            if (!albumsMap.has(albumId)) {
              albumsMap.set(albumId, {
                ...track.album,
                playCount: 1,
                artists: track.artists
              });
            } else {
              const album = albumsMap.get(albumId);
              albumsMap.set(albumId, {
                ...album,
                playCount: album.playCount + 1
              });
            }
          }
        });
      }
  
      const topAlbumsData = Array.from(albumsMap.values())
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 14);  // Limit albums to 14
  
      setTopAlbums(topAlbumsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load music data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedTimeRange]);

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
        const tracks = response.data.filter(track => 
          track.uri && 
          !track.uri.includes('spotify:local') && 
          track.uri.startsWith('spotify:track:')
        );
        console.log(`Loaded ${tracks.length} valid tracks from playlist`);
        setPlaylistTracks(tracks);
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
      return { duration: 0, topGenre: 'Unknown', lastUpdated: 'Never' };
    }
  
    try {
      // Calculate total duration - safely handle null/undefined tracks
      const totalDuration = playlistTracks.reduce((sum, track) => {
        if (!track || typeof track !== 'object') return sum;
        return sum + (track.duration_ms || 0);
      }, 0);
      
      const durationInMinutes = Math.floor(totalDuration / 60000);
  
      // Get top genre - safely handle missing artist/genre data
      const genreCounts = {};
      playlistTracks.forEach(track => {
        if (!track || !Array.isArray(track.artists)) return;
        
        track.artists.forEach(artist => {
          if (!artist || !Array.isArray(artist.genres)) return;
          
          artist.genres.forEach(genre => {
            if (typeof genre === 'string') {
              genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            }
          });
        });
      });
  
      const topGenre = Object.entries(genreCounts).length > 0 
        ? Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0][0]
        : 'Various';
  
      // Format last updated date - safely handle missing data
      let lastUpdated = 'Recently';
      if (selectedPlaylist.tracks?.items?.[0]?.added_at) {
        try {
          lastUpdated = new Date(selectedPlaylist.tracks.items[0].added_at).toLocaleDateString();
        } catch (e) {
          console.warn('Error formatting date:', e);
        }
      }
  
      return {
        duration: `${durationInMinutes} mins`,
        topGenre,
        lastUpdated
      };
    } catch (error) {
      console.error('Error calculating playlist stats:', error);
      return { duration: '0 mins', topGenre: 'Various', lastUpdated: 'Recently' };
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

      // Check if we're playing from a playlist and have valid playlist data
      if (selectedPlaylist?.uri && selectedPlaylist?.tracks?.items) {
        console.log("Attempting to play from playlist:", selectedPlaylist.uri);
        
        // Find the track index in the playlist
        const trackIndex = selectedPlaylist.tracks.items.findIndex(item => 
          item.track && item.track.id === track.id
        );
        
        console.log("Track index in playlist:", trackIndex);
        
        if (trackIndex !== -1) {
          // Play using playlist context
          const response = await axios.put('/api/spotify/play', {
            context_uri: selectedPlaylist.uri,
            offset: { position: trackIndex },
            deviceId
          });
          console.log("API response:", response.data);
          setCurrentTrack(track);
          setIsPlaying(true);
          return;
        }
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
      const response = await axios.put('/api/spotify/play', {
        uris: trackUris,
        deviceId,
        position_ms: 0
      });

      console.log("API response:", response.data);
      setQueue(trackQueue.slice(1));
      setCurrentTrack(trackQueue[0]);
      setIsPlaying(true);

    } catch (error) {
      console.error("Error playing track:", error);
      if (error.response?.data?.error) {
        alert(`Error: ${error.response.data.error}`);
      } else {
        alert(`Error: ${error.message || 'Failed to play track'}`);
      }
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
        const [currentResponse, queueResponse] = await Promise.all([
          axios.get('/api/spotify/player/current', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
            }
          }),
          axios.get('/api/spotify/player/state', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
            }
          })
        ]);

        if (currentResponse.data?.item) {
          // Batch state updates together
          const updates = {
            currentTrack: currentResponse.data.item,
            queue: queueResponse.data?.queue || []
          };
          
          // Update both states at once to prevent multiple re-renders
          setCurrentTrack(updates.currentTrack);
          setQueue(updates.queue);
        }
      } catch (error) {
        console.debug('State update failed:', error);
      }
    }, 200), // Reduced from 300ms to 200ms
    []
  );

  useEffect(() => {
    if (!isPlaying) return;

    // Initial update
    debouncedUpdateState();

    // Update every 1.5 seconds while playing (reduced from 2s)
    const interval = setInterval(debouncedUpdateState, 1500);
    return () => {
      clearInterval(interval);
      debouncedUpdateState.cancel?.();
    };
  }, [isPlaying, debouncedUpdateState]);

  const handleNext = async () => {
    try {
      // Optimistically update UI state
      const nextTrack = queue[0];
      if (nextTrack) {
        setCurrentTrack(nextTrack);
        setQueue(prevQueue => prevQueue.slice(1));
      }

      await axios.post('/api/spotify/player/next', {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
        }
      });

      // Small delay before getting actual state
      await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms to 50ms
      await debouncedUpdateState();
    } catch (error) {
      console.error('Error skipping to next track:', error);
      debouncedUpdateState();
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

  const updatePlayerState = async () => {
    try {
      const response = await axios.get('/api/spotify/player/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
        }
      });

      if (response.data?.item) {
        setCurrentTrack(response.data.item);
        if (response.data.queue) {
          setQueue(response.data.queue);
        }
      }
    } catch (error) {
      console.error('Error updating player state:', error);
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
  const { duration, topGenre, lastUpdated } = getPlaylistStats();
  
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
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-6">
            <button
              onClick={handleBackToMain}
              className="hover:bg-white/10 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold">{selectedPlaylist?.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                <span>{duration}</span>
                <span>•</span>
                <span>{topGenre}</span>
                <span>•</span>
                <span>Updated {lastUpdated}</span>
              </div>
            </div>
          </div>
        </div>

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
              <div className="relative aspect-square">
                <img
                  src={artist.images[0]?.url}
                  alt={artist.name}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="mt-2 text-center">
                <h3 className="font-medium truncate">{index + 1}. {artist.name}</h3>
              </div>
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
                <div className="relative aspect-square">
                  <img
                    src={artist.images[0]?.url}
                    alt={artist.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <div className="mt-2 text-center">
                  <h3 className="font-medium truncate">{index + 8}. {artist.name}</h3>
                </div>
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
              <div className="relative aspect-square">
                <img
                  src={album.images[0]?.url}
                  alt={album.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div className="mt-2">
                <h3 className="font-medium truncate">{index + 1}. {album.name}</h3>
                <p className="text-sm text-gray-400 truncate">
                  {album.artists.map(a => a.name).join(', ')}
                </p>
              </div>
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
                <div className="relative aspect-square">
                  <img
                    src={album.images[0]?.url}
                    alt={album.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="mt-2">
                  <h3 className="font-medium truncate">{index + 8}. {album.name}</h3>
                  <p className="text-sm text-gray-400 truncate">
                    {album.artists.map(a => a.name).join(', ')}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const TrackItem = ({ track, onClick, isPlaying, index }) => {
    const [isQueueAnimating, setIsQueueAnimating] = useState(false);

    const handleQueueClick = (e) => {
      setIsQueueAnimating(true);
      handleAddToQueue(track, e);
      setTimeout(() => setIsQueueAnimating(false), 1000);
    };

    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors ${
          isPlaying ? 'bg-white/10' : ''
        }`}
      >
        <span className="text-sm text-gray-400 w-6 text-right">{index}</span>
        <img 
          src={track.album?.images[0]?.url || '/default-track.png'} 
          alt="" 
          className="w-12 h-12 rounded object-cover"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{track.name}</p>
          <p className="text-sm text-gray-400 truncate">
            {track.artists.map(artist => artist.name).join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm text-gray-400">
            {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
          </div>
          <motion.button
            onClick={handleQueueClick}
            className="p-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 
                     transition-colors group relative overflow-hidden"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={isQueueAnimating ? {
              scale: [1, 1.2, 0.9, 1.1, 1],
              rotate: [0, 15, -15, 5, 0],
            } : {}}
            transition={{
              duration: 0.6,
              ease: [0.76, 0, 0.24, 1],
            }}
          >
            <motion.div
              className="absolute inset-0 bg-purple-400/20"
              initial={{ scale: 0, opacity: 0 }}
              animate={isQueueAnimating ? {
                scale: [1, 3],
                opacity: [0.5, 0],
              } : {}}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                borderRadius: "100%",
                transformOrigin: "center",
              }}
            />
            <motion.div
              className="absolute inset-0 bg-purple-400/10"
              initial={{ scale: 0, opacity: 0 }}
              animate={isQueueAnimating ? {
                scale: [1, 2],
                opacity: [0.3, 0],
              } : {}}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
              style={{
                borderRadius: "100%",
                transformOrigin: "center",
              }}
            />
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transform group-hover:translate-x-0.5 transition-transform relative z-10"
              animate={isQueueAnimating ? {
                scale: [1, 1.2, 1],
                rotate: [0, 180, 180],
              } : {}}
              transition={{
                duration: 0.4,
                ease: "easeOut",
              }}
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </motion.svg>
          </motion.button>
        </div>
      </div>
    );
  };

  const MainPageTrackItem = ({ track, index, onClick }) => (
    <div
      key={track.id}
      className="group relative"
      onMouseEnter={() => setHoveredTrack(track.id)}
      onMouseLeave={() => setHoveredTrack(null)}
      onClick={onClick}
    >
      <div className="relative aspect-square">
        <img
          src={track.album?.images[0]?.url}
          alt={track.name}
          className="w-full h-full object-cover rounded-lg"
        />
        {hoveredTrack === track.id && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
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
        )}
      </div>
      <div className="mt-2">
        <h3 className="font-medium truncate">{index}. {track.name}</h3>
        <p className="text-sm text-gray-400 truncate">
          {track.artists.map(a => a.name).join(', ')}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
        </p>
      </div>
    </div>
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
          <div className="fixed left-5 top-1/2 -translate-y-1/2 z-50">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-2 shadow-xl border border-white/5">
              <div 
                className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto"
              >
                {playlists.map((playlist, index) => (
                  <button
                    key={`${playlist.id}-${index}`}
                    onClick={() => handlePlaylistSelect(playlist)}
                    className={`group relative w-36 h-12 rounded-xl overflow-hidden transition-all hover:scale-105 ${
                      selectedPlaylist?.id === playlist.id 
                        ? 'ring-2 ring-purple-500 ring-offset-1 ring-offset-black/50' 
                        : ''
                    }`}
                    title={playlist.name}
                  >
                    <div className="absolute inset-0 flex items-center">
                      <img 
                        src={playlist.images[0]?.url || '/default-playlist.png'} 
                        alt=""
                        className="w-12 h-12 object-cover"
                      />
                      <div className="flex-1 px-2 text-left truncate">
                        <p className="text-xs font-medium text-white truncate">{playlist.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {playlist.tracks?.total || 0} tracks
                        </p>
                      </div>
                    </div>
                  </button>
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
