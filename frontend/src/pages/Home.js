import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import PlayerNotch from '../components/PlayerNotch';
import SpotifyPlayer from '../components/SpotifyPlayer';

const API_URL = 'http://localhost:5001/api';

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
  const { scrollY } = useScroll();
  
  // Parallax effect values
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 200], [1, 0]);

  const refreshAccessToken = async () => {
    try {
      const refresh_token = localStorage.getItem('spotify_refresh_token');
      if (!refresh_token) {
        throw new Error('No refresh token available');
      }

      const response = await axios.get(`${API_URL}/auth/refresh`, {
        params: { refresh_token }
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

      const response = await axios.get(`${API_URL}${endpoint}`, {
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

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching data with time range:', selectedTimeRange); // Add logging
      
      // Fetch both tracks and artists with the same time range
      const [topTracksData, topArtistsData] = await Promise.all([
        fetchData(`/tracks/top?time_range=${selectedTimeRange}`),
        fetchData(`/artists/top?time_range=${selectedTimeRange}`)
      ]);
  
      console.log('Received tracks:', topTracksData?.length); // Add logging
      console.log('Received artists:', topArtistsData?.length); // Add logging
      
      // Update tracks first
      setTopTracks(topTracksData || []);
      setTopArtists(topArtistsData || []);
  
      // Generate top albums from the tracks
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
        .slice(0, 10);
  
      setTopAlbums(topAlbumsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load music data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('spotify_access_token');
    if (!token) {
      navigate('/');
      return;
    }
    fetchAllData();
  }, [navigate, selectedTimeRange]); // Re-fetch when time range changes

  const handleLogout = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    navigate('/');
  };

  const handleTrackSelect = (track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    // Add next few tracks to queue
    const currentIndex = topTracks.findIndex(t => t.id === track.id);
    const nextTracks = topTracks.slice(currentIndex + 1, currentIndex + 4);
    setQueue(nextTracks);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (!currentTrack || !topTracks.length) return;
    const currentIndex = topTracks.findIndex(t => t.id === currentTrack.id);
    const nextTrack = topTracks[currentIndex + 1];
    if (nextTrack) {
      handleTrackSelect(nextTrack);
    }
  };

  const handlePrevious = () => {
    if (!currentTrack || !topTracks.length) return;
    const currentIndex = topTracks.findIndex(t => t.id === currentTrack.id);
    const prevTrack = topTracks[currentIndex - 1];
    if (prevTrack) {
      handleTrackSelect(prevTrack);
    }
  };

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

  const renderTrackList = (tracks, title) => {
    const isExpanded = expandedSection === 'tracks';
    const displayTracks = isExpanded ? tracks : tracks.slice(0, 7);
    const hiddenTracks = isExpanded ? tracks.slice(7) : [];

    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-purple-400">Your top tracks from {TimeRangeLabels[selectedTimeRange].toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-3 py-1 text-sm rounded-full bg-black/40 border border-purple-500/20 
                       text-purple-400 hover:bg-purple-600/20 cursor-pointer appearance-none
                       focus:outline-none focus:ring-2 focus:ring-purple-500/40
                       pr-8 relative transition-colors backdrop-blur-sm"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239F7AEA'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '16px'
              }}
            >
              <option value={TimeRanges.SHORT} className="bg-black text-purple-400">Last 4 Weeks</option>
              <option value={TimeRanges.MEDIUM} className="bg-black text-purple-400">Last 6 Months</option>
              <option value={TimeRanges.LONG} className="bg-black text-purple-400">Last Year</option>
            </select>
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
          {displayTracks.slice(0, 7).map((track, index) => (
            <div
              key={track.id}
              className="group relative"
              onMouseEnter={() => setHoveredTrack(track.id)}
              onMouseLeave={() => setHoveredTrack(null)}
              onClick={() => handleTrackSelect(track)}
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
                <h3 className="font-medium truncate">{index + 1}. {track.name}</h3>
                <p className="text-sm text-gray-400 truncate">
                  {track.artists.map(a => a.name).join(', ')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                </p>
              </div>
            </div>
          ))}
          <AnimatePresence>
            {isExpanded && hiddenTracks.map((track, index) => (
              <motion.div
                key={track.id}
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
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: "easeOut"
                }}
                className="group relative"
                onMouseEnter={() => setHoveredTrack(track.id)}
                onMouseLeave={() => setHoveredTrack(null)}
                onClick={() => handleTrackSelect(track)}
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
                  <h3 className="font-medium truncate">{index + 8}. {track.name}</h3>
                  <p className="text-sm text-gray-400 truncate">
                    {track.artists.map(a => a.name).join(', ')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const renderArtistList = (artists, title) => {
    const isExpanded = expandedSection === 'artists';
    const displayArtists = isExpanded ? artists : artists.slice(0, 7);
    const hiddenArtists = isExpanded ? artists.slice(7) : [];

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
          {displayArtists.slice(0, 7).map((artist, index) => (
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
                key={artist.id}
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
                  duration: 0.3,
                  delay: index * 0.05,
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
    const displayAlbums = isExpanded ? albums : albums.slice(0, 7);
    const hiddenAlbums = isExpanded ? albums.slice(7) : [];

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
          {displayAlbums.slice(0, 7).map((album, index) => (
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
                key={album.id}
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
                  duration: 0.3,
                  delay: index * 0.05,
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

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-purple-900/10 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_65%)] from-purple-900/10" />
      </div>

      {/* Content */}
      <div className="relative">
        <div className="container mx-auto px-4 py-8">
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
          <div className="space-y-4">
            {renderTrackList(topTracks, 'Top tracks')}
            {renderArtistList(topArtists, 'Top artists')}
            {renderAlbumList(topAlbums, 'Top albums')}
          </div>
        </div>
      </div>

      {currentTrack && (
        <>
          <PlayerNotch
            track={currentTrack}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onPrevious={handlePrevious}
            queue={queue}
          />
          <SpotifyPlayer
            uri={currentTrack.uri}
            isPlaying={isPlaying}
            onPlayPause={setIsPlaying}
          />
        </>
      )}
    </div>
  );
};

export default Home;
