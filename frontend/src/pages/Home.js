import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef 
} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import PlayerNotch from '../components/player/PlayerNotch';
import SpotifyPlayer from '../components/player/SpotifyPlayer';
import LoadingScreen from '../components/loading/LoadingScreen';
import axios from 'axios';
import { api } from '../utils/spotifyApi';
import toast, { Toaster } from 'react-hot-toast';
import { usePlayerContext } from '../contexts/PlayerContext';
import '../styles/playlist-container.css';
import { initializeSpotifySDK } from '../utils/spotifySDK';
import AnimatedBackground from '../components/background/AnimatedBackground';
import PlaylistSidebar from '../components/playlist/PlaylistSidebar';
import { TimeRanges, TimeRangeLabels, timeRanges } from '../constants/timeRanges';
import TimeRangeSelector from '../components/timeRange/TimeRangeSelector';
import PlaylistStats from '../components/playlist/PlaylistStats';
import PlaylistHeader from '../components/playlist/PlaylistHeader';
import PlaylistView from '../components/playlist/PlaylistView';
import { decodeHtmlEntities } from '../utils/helpers';
import { sortOptions } from '../constants/sortOptions';
import MainPageHeader from '../components/mainPage/MainPageHeader';
import MainPageTrackList from '../components/mainPage/MainPageTrackList';
import MainPageArtistList from '../components/mainPage/MainPageArtistList';
import MainPageAlbumList from '../components/mainPage/MainPageAlbumList';
import MainPageRecentTrackList from '../components/mainPage/MainPageRecentTrackList';
import { playlistCache, uiStateCache, playerCache, CACHE_DURATION, CACHE_KEYS } from '../utils/cacheManager';
import debounce from 'lodash/debounce';
import { usePlayerStateUpdate } from '../hooks/usePlayerStateUpdate';
import ArtistView from '../components/artist/ArtistView';
import AlbumView from '../components/album/AlbumView';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const Home = () => {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(TimeRanges.SHORT);
  const [expandedSection, setExpandedSection] = useState(null);
  const { currentTrack, updateCurrentTrack, setIsPlaying: setPlayerIsPlaying } = usePlayerContext();
  const [playlists, setPlaylists] = useState([]);
  const fetchingPlaylistsRef = useRef(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showPlaylistView, setShowPlaylistView] = useState(false);
  const [isPlaylistTransition, setIsPlaylistTransition] = useState(false);
  const [recentTracks, setRecentTracks] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showArtistView, setShowArtistView] = useState(false);
  const [showAlbumView, setShowAlbumView] = useState(false);
  const [isArtistTransition, setIsArtistTransition] = useState(false);
  const [isAlbumTransition, setIsAlbumTransition] = useState(false);
  const { scrollY } = useScroll();
  const [currentPage, setCurrentPage] = useState(0);
  const TRACKS_PER_PAGE = 100;

  const playlistContainerRef = useRef(null);
  const loadingRef = useRef(null);
  const loadingTimeoutRef = useRef(null);
  const lastVisibleTrackRef = useRef(null);

  // Memoize album processing
  const processTopAlbums = useCallback((tracks) => {
    if (!tracks || !Array.isArray(tracks)) return [];
    
    const albumsMap = new Map();
    tracks.forEach(track => {
      if (!track?.album?.id) return;
      
      const albumId = track.album.id;
      const cacheKey = `album:${albumId}`;
      const cachedAlbum = uiStateCache.get(cacheKey);
      
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
        uiStateCache.set(cacheKey, albumData, CACHE_DURATION.UI_STATE);
        albumsMap.set(albumId, albumData);
      }
    });

    return Array.from(albumsMap.values())
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 14);
  }, []);

  // Fetch recent tracks
  const fetchRecentTracks = useCallback(async () => {
    try {
      const cacheKey = CACHE_KEYS.RECENT_TRACKS;
      const cachedData = uiStateCache.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }

      const data = await fetchData('/api/tracks/recent?limit=28');
      
      if (data && Array.isArray(data)) {
        uiStateCache.set(cacheKey, data, CACHE_DURATION.UI_STATE);
        return data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching recent tracks:', error);
      return [];
    }
  }, []);

  // Optimize track data fetching
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use CacheManager instead of local ref cache
      const cacheKey = CACHE_KEYS.TIME_RANGE_DATA(selectedTimeRange);
      const cachedData = await uiStateCache.get(cacheKey);
      
      // Fetch recent tracks regardless of time range cache
      const recentTracksData = await fetchRecentTracks();
      setRecentTracks(recentTracksData);
      
      if (cachedData) {
        const { tracks, artists } = cachedData;
        setTopTracks(tracks);
        setTopArtists(artists);
        setTopAlbums(processTopAlbums(tracks));
        setLoading(false);
        return;
      }
      
      // Fetch fresh data if cache is missing
      const [topTracksData, topArtistsData] = await Promise.all([
        fetchData(`/api/tracks/top?time_range=${selectedTimeRange}&limit=28`),
        fetchData(`/api/artists/top?time_range=${selectedTimeRange}&limit=21`)
      ]);

      if (topTracksData && Array.isArray(topTracksData)) {
        setTopTracks(topTracksData);
        const processedAlbums = processTopAlbums(topTracksData);
        setTopAlbums(processedAlbums);
        
        // Update cache using CacheManager
        await uiStateCache.set(cacheKey, {
          tracks: topTracksData,
          artists: topArtistsData
        }, CACHE_DURATION.TIME_RANGE);
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
  }, [selectedTimeRange, processTopAlbums, fetchRecentTracks]);

  

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
    console.log('Effect running, fetchingPlaylistsRef:', fetchingPlaylistsRef.current);
    
    const fetchPlaylists = async (limit = 35) => {
      if (fetchingPlaylistsRef.current) {
        console.log('Preventing duplicate fetch due to StrictMode');
        return;
      }
      console.log('Starting playlist fetch');
      fetchingPlaylistsRef.current = true;
      
      try {
        // Check cache first
        const cacheKey = CACHE_KEYS.USER_PLAYLISTS;
        const cachedPlaylists = await playlistCache.get(cacheKey);
        
        if (cachedPlaylists) {
          console.log('Using cached playlists');
          setPlaylists(cachedPlaylists);
          return;
        }

        console.log('Cache miss, fetching from API');
        const response = await api.get(`/api/spotify/playlists?limit=${limit}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('spotify_access_token')}`
          }
        });
        console.log('API response received:', response.data);
        // Cache the playlists
        await playlistCache.set(cacheKey, response.data, CACHE_DURATION.PLAYLIST);
        setPlaylists(response.data);
      } catch (error) {
        console.error('Error fetching playlists:', error.response || error);
      } finally {
        fetchingPlaylistsRef.current = false;
        console.log('Fetch complete, ref reset');
      }
    };

    fetchPlaylists();
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchPlaylistDetails = async () => {
      if (!playlists.length) return;
      
      try {
        const playlistIds = playlists.map(p => p.id).join(',');
        const response = await api.get(`/api/spotify/playlists/details?playlistIds=${playlistIds}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('spotify_access_token')}`
          }
        });
        
        if (!isMounted) return;

        // Update playlists with detailed stats
        setPlaylists(prevPlaylists => {
          const updatedPlaylists = prevPlaylists.map(playlist => {
            const details = response.data.find(d => d.id === playlist.id);
            if (details) {
              return {
                ...playlist,
                ...details
              };
            }
            return playlist;
          });

          // Update cache with new data
          const cacheKey = CACHE_KEYS.USER_PLAYLISTS;
          playlistCache.set(cacheKey, updatedPlaylists, CACHE_DURATION.PLAYLIST);

          return updatedPlaylists;
        });
      } catch (error) {
        console.error('Error fetching playlist details:', error);
      }
    };

    // Fetch details immediately after initial load
    if (playlists.length > 0) {
      fetchPlaylistDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [playlists.length]);

  useEffect(() => {
    const token = localStorage.getItem('spotify_access_token');
    if (!token) {
      navigate('/');
      return;
    }
    fetchAllData();
  }, [navigate, fetchAllData]); // Re-fetch when time range changes

  useEffect(() => {
    // Set up axios defaults
    axios.defaults.baseURL = API_URL;
    axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('spotify_access_token')}`;
    
    initializeSpotifySDK().then(() => {
      setSdkReady(true);
    });
  }, []);

  useEffect(() => {
    if (sdkReady && !loading) {
      const timer = setTimeout(() => {
        setInitialLoading(false);
      }, 1000); // Minimum loading screen duration

      return () => clearTimeout(timer);
    }
  }, [sdkReady, loading]);

  useEffect(() => {
    // Prevent scrolling on the main page when artist or album view is open
    if (showArtistView || showAlbumView) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    // Cleanup when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showArtistView, showAlbumView]);

  const handleLogout = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    navigate('/');
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

      // Get the current list of tracks based on where the track was selected from
      let currentTracks = trackList;
      if (!currentTracks || !Array.isArray(currentTracks)) {
        // If no trackList provided, try to determine which list the track is from
        if (recentTracks.some(t => t.id === track.id)) {
          currentTracks = recentTracks;
        } else {
          currentTracks = topTracks;
        }
      }

      // Find the selected track's index
      const currentIndex = currentTracks.findIndex(t => t && t.id === track.id);
      if (currentIndex === -1) {
        throw new Error("Selected track not found in track list");
      }

      // Get the next tracks for the queue (up to 50 tracks)
      const nextTracks = currentTracks
        .slice(currentIndex + 1)
        .concat(currentTracks.slice(0, currentIndex))
        .filter(t => 
          t && 
          t.uri && 
          !t.uri.includes('spotify:local') && 
          t.uri.startsWith('spotify:track:')
        )
        .slice(0, 50);

      // Start playback with the selected track
      await axios.put('/api/spotify/player/play', {
        device_id: deviceId,
        uris: [track.uri, ...nextTracks.map(t => t.uri)]
      });

      // Update the queue state
      setQueue(nextTracks);
      updateCurrentTrack(track);
      setIsPlaying(true);
      setPlayerIsPlaying(true);

    } catch (error) {
      console.error("Error playing track:", error);
      toast.error(`Error: ${error.message || 'Failed to play track'}`, {
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

  // Unified state update function
  const updatePlayerState = useCallback(async () => {
    try {
      const response = await axios.get('/api/spotify/player/state');
      if (response.data?.item && response.data.item.id !== currentTrack?.id) {
        updateCurrentTrack(response.data.item);
      }
      // Restore queue update logic
      if (response.data?.queue) {
        setQueue(prevQueue => {
          const areQueuesEqual = prevQueue.length === response.data.queue.length &&
            prevQueue.every((track, index) => track.id === response.data.queue[index].id);
          return areQueuesEqual ? prevQueue : response.data.queue;
        });
      }
      // Restore player state updates
      setIsPlaying(!response.data?.is_paused);
      setPlayerIsPlaying(!response.data?.is_paused);
    } catch (error) {
      console.error('Error updating player state:', error);
    }
  }, [currentTrack?.id, updateCurrentTrack, setPlayerIsPlaying]);

  // Use the custom hook for player state updates
  const debouncedUpdateState = usePlayerStateUpdate(updatePlayerState, isPlaying);

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

  const handleArtistClick = (artist) => {
    setSelectedArtist(artist);
    setShowArtistView(true);
    setIsArtistTransition(true);
  };

  const handleAlbumClick = (album) => {
    setSelectedAlbum(album);
    setShowAlbumView(true);
    setIsAlbumTransition(true);
  };

  const handleBackFromArtist = () => {
    setShowArtistView(false);
    setIsArtistTransition(false);
  };

  const handleBackFromAlbum = () => {
    setShowAlbumView(false);
    setIsAlbumTransition(false);
  };

  const renderMainContent = () => (
    <motion.div 
      initial={false}
      animate={{ x: showPlaylistView ? "-100%" : 0, opacity: showPlaylistView ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-full"
    >
      <MainPageHeader onLogout={handleLogout} />

      <div className="space-y-8">
        <MainPageTrackList
          tracks={topTracks}
          title="Top tracks"
          expandedSection={expandedSection}
          selectedTimeRange={selectedTimeRange}
          onTimeRangeChange={(newRange) => setSelectedTimeRange(newRange)}
          onExpandSection={setExpandedSection}
          onTrackSelect={handleTrackSelect}
        />

        <MainPageArtistList
          artists={topArtists}
          title="Top artists"
          expandedSection={expandedSection}
          selectedTimeRange={selectedTimeRange}
          onTimeRangeChange={(newRange) => setSelectedTimeRange(newRange)}
          onExpandSection={setExpandedSection}
          onArtistSelect={handleArtistClick}
        />

        <MainPageAlbumList
          albums={topAlbums}
          title="Top albums"
          expandedSection={expandedSection}
          selectedTimeRange={selectedTimeRange}
          onTimeRangeChange={(newRange) => setSelectedTimeRange(newRange)}
          onExpandSection={setExpandedSection}
          onAlbumSelect={handleAlbumClick}
        />

        <MainPageRecentTrackList
          tracks={recentTracks}
          expandedSection={expandedSection}
          onExpandSection={setExpandedSection}
          onTrackSelect={handleTrackSelect}
        />
      </div>
    </motion.div>
  );

  const renderPlaylistView = () => {
    return (
      <PlaylistView 
        playlist={selectedPlaylist}
        onBack={handleBackToMain}
        isPlaylistTransition={isPlaylistTransition}
        showPlaylistView={showPlaylistView}
        onTrackSelect={(track, tracks) => handleTrackSelect(track, tracks)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onAddToQueue={handleAddToQueue}
      />
    );
  };

  if (initialLoading || !sdkReady) {
    return <LoadingScreen sdkReady={sdkReady} initialLoading={initialLoading} />;
  }

  return (
    <div className="min-h-screen text-white pb-24">
      <Toaster />
      <AnimatedBackground />
      {/* Content */}
      <div className="relative">
        <SpotifyPlayer
          uri={currentTrack?.uri}
          isPlaying={isPlaying}
          onPlayPause={setIsPlaying}
        />
        <div className="flex">
          <PlaylistSidebar
            playlists={playlists}
            selectedPlaylist={selectedPlaylist}
            onPlaylistSelect={handlePlaylistSelect}
          />

          {/* Main Content */}
          <div className="flex-1 pl-20">
            <div className="container mx-auto px-4 py-8 relative overflow-hidden">
              {renderMainContent()}
              {renderPlaylistView()}
              {selectedArtist && (
                <ArtistView
                  artist={selectedArtist}
                  onBack={handleBackFromArtist}
                  isArtistTransition={isArtistTransition}
                  showArtistView={showArtistView}
                  onTrackSelect={handleTrackSelect}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onAddToQueue={handleAddToQueue}
                />
              )}
              {selectedAlbum && (
                <AlbumView
                  album={selectedAlbum}
                  onBack={handleBackFromAlbum}
                  isAlbumTransition={isAlbumTransition}
                  showAlbumView={showAlbumView}
                  onTrackSelect={handleTrackSelect}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onAddToQueue={handleAddToQueue}
                />
              )}
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