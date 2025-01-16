import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import PlayerNotch from '../components/PlayerNotch';
import SpotifyPlayer from '../components/SpotifyPlayer';
import { motion, useScroll, useTransform } from 'framer-motion';

const API_URL = 'http://localhost:5001/api';

const TimeRanges = {
  SHORT: 'short_term',
  MEDIUM: 'medium_term',
  LONG: 'long_term'
};

const TimeRangeLabels = {
  [TimeRanges.SHORT]: 'Last 4 weeks',
  [TimeRanges.MEDIUM]: 'Last 6 months',
  [TimeRanges.LONG]: 'All time'
};

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
  const [timeRange, setTimeRange] = useState(TimeRanges.SHORT);
  const [hoveredTrack, setHoveredTrack] = useState(null);

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
      
      const [topTracksData, topArtistsData] = await Promise.all([
        fetchData(`/tracks/top?time_range=${timeRange}`),
        fetchData(`/artists/top?time_range=${timeRange}`)
      ]);

      // Initialize arrays if they're undefined
      setTopTracks(topTracksData || []);
      setTopArtists(topArtistsData || []);

      // Generate top albums from top tracks
      const albumsMap = new Map();
      if (topTracksData) {
        topTracksData.forEach(track => {
          if (track.album && !albumsMap.has(track.album.id)) {
            albumsMap.set(track.album.id, {
              ...track.album,
              playCount: 1,
              artists: track.artists // Add artists from the track
            });
          } else if (track.album) {
            const album = albumsMap.get(track.album.id);
            albumsMap.set(track.album.id, {
              ...album,
              playCount: album.playCount + 1
            });
          }
        });
      }

      const topAlbumsData = Array.from(albumsMap.values())
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 10)
        .map(album => ({
          ...album,
          artists: album.artists || [] // Ensure artists is always an array
        }));

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
  }, [navigate, timeRange]);

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

  const handleArtistPlay = async (artist) => {
    try {
      const response = await fetch(`${API_URL}/artists/${artist.id}/top-tracks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('spotifyToken')}`
        }
      });
      const data = await response.json();
      if (data && data.length > 0) {
        const randomTrack = data[Math.floor(Math.random() * data.length)];
        handleTrackSelect(randomTrack);
      }
    } catch (error) {
      console.error('Error playing artist track:', error);
    }
  };

  const handleAlbumPlay = async (album) => {
    try {
      const response = await fetch(`${API_URL}/albums/${album.id}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('spotifyToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ albumImages: album.images })
      });
      const data = await response.json();
      if (data && data.length > 0) {
        const randomTrack = data[Math.floor(Math.random() * data.length)];
        handleTrackSelect(randomTrack);
      }
    } catch (error) {
      console.error('Error playing album track:', error);
    }
  };

  const { scrollY } = useScroll();
  const backgroundY = useTransform(scrollY, [0, 1000], [0, 200]);

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

  const renderTrackList = (tracks, title) => (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-green-400">Your top tracks from the {TimeRangeLabels[timeRange].toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimeRange(TimeRanges.SHORT)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              timeRange === TimeRanges.SHORT ? 'bg-green-500 text-black' : 'text-green-400 hover:bg-green-500/10'
            }`}
          >
            4 weeks
          </button>
          <button
            onClick={() => setTimeRange(TimeRanges.MEDIUM)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              timeRange === TimeRanges.MEDIUM ? 'bg-green-500 text-black' : 'text-green-400 hover:bg-green-500/10'
            }`}
          >
            6 months
          </button>
          <button
            onClick={() => setTimeRange(TimeRanges.LONG)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              timeRange === TimeRanges.LONG ? 'bg-green-500 text-black' : 'text-green-400 hover:bg-green-500/10'
            }`}
          >
            All time
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {tracks.map((track, index) => (
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
                  <button className="p-3 bg-green-500 rounded-full hover:scale-105 transition-transform">
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
              <h3 className="font-medium truncate text-white">{track.name}</h3>
              <p className="text-sm text-white/80 truncate">
                {track.artists.map(a => a.name).join(', ')}
              </p>
              <p className="text-xs text-white/60 mt-1">
                {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')} • {index + 1} streams
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderArtistList = (artists, title) => (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-green-400">Your top artists from the {TimeRangeLabels[timeRange].toLowerCase()}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {artists.map((artist, index) => (
          <div 
            key={artist.id} 
            className="group relative"
            onMouseEnter={() => setHoveredTrack(artist.id)}
            onMouseLeave={() => setHoveredTrack(null)}
          >
            <div className="relative aspect-square">
              <img
                src={artist.images[0]?.url}
                alt={artist.name}
                className="w-full h-full object-cover rounded-full"
              />
              {hoveredTrack === artist.id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                  <button 
                    className="p-3 bg-green-500 rounded-full hover:scale-105 transition-transform"
                    onClick={() => handleArtistPlay(artist)}
                  >
                    <svg className="w-6 h-6" fill="white" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2 text-center">
              <h3 className="font-medium truncate text-white">{artist.name}</h3>
              <p className="text-xs text-white/60 mt-1">
                {artist.minutes} minutes • {artist.streams} streams
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAlbumList = (albums, title) => (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-green-400">Your top albums from the {TimeRangeLabels[timeRange].toLowerCase()}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {albums.map((album, index) => (
          <div 
            key={album.id} 
            className="group relative"
            onMouseEnter={() => setHoveredTrack(album.id)}
            onMouseLeave={() => setHoveredTrack(null)}
          >
            <div className="relative aspect-square">
              <img
                src={album.images[0]?.url}
                alt={album.name}
                className="w-full h-full object-cover rounded-lg"
              />
              {hoveredTrack === album.id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                  <button 
                    className="p-3 bg-green-500 rounded-full hover:scale-105 transition-transform"
                    onClick={() => handleAlbumPlay(album)}
                  >
                    <svg className="w-6 h-6" fill="white" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2">
              <h3 className="font-medium truncate text-white">{album.name}</h3>
              <p className="text-sm text-white/80 truncate">
                {album.artists.map(a => a.name).join(', ')}
              </p>
              <p className="text-xs text-white/60 mt-1">
                {album.playCount} plays
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{ y: backgroundY }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-400/5 via-green-400/2 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_65%)] from-green-400/3" />
      </motion.div>
      <div className="max-w-[1800px] mx-auto p-8 relative">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">SpotCIRCLE</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-green-500/10 text-green-400 rounded-full hover:bg-green-500/20 hover:text-green-300 transition-colors"
          >
            Logout
          </button>
        </div>

        {error ? (
          <div className="text-center text-red-500 bg-red-500/10 p-4 rounded-lg">
            {error}
            <button
              onClick={() => window.location.reload()}
              className="block mx-auto mt-4 px-4 py-2 bg-green-500/10 text-green-400 rounded-full hover:bg-green-500/20 hover:text-green-300 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {renderTrackList(topTracks, 'Top Tracks')}
            {renderArtistList(topArtists, 'Top Artists')}
            {renderAlbumList(topAlbums, 'Top Albums')}
          </>
        )}

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
    </div>
  );
};

export default Home;
