import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import TrackItem from '../tracks/TrackItem';
import { uiStateCache, CACHE_DURATION, CACHE_KEYS } from '../../utils/cacheManager';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const ArtistView = ({
  artist,
  onBack,
  isArtistTransition,
  showArtistView,
  onTrackSelect,
  currentTrack,
  isPlaying,
  onAddToQueue
}) => {
  const [topTracks, setTopTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchArtistTopTracks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const cacheKey = `artist:${artist.id}:top_tracks`;
      const cachedData = uiStateCache.get(cacheKey);

      if (cachedData) {
        setTopTracks(cachedData);
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`/api/spotify/artists/${artist.id}/top-tracks`);
      const tracks = response.data;

      uiStateCache.set(cacheKey, tracks, CACHE_DURATION.UI_STATE);
      setTopTracks(tracks);
    } catch (err) {
      console.error('Error fetching artist top tracks:', err);
      setError('Failed to load artist tracks');
    } finally {
      setIsLoading(false);
    }
  }, [artist.id]);

  useEffect(() => {
    if (showArtistView) {
      fetchArtistTopTracks();
    }
  }, [showArtistView, fetchArtistTopTracks]);

  const getItemSize = useCallback((index) => {
    return 72; // Height of each track item
  }, []);

  return (
    <AnimatePresence>
      {showArtistView && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-gradient-to-b from-purple-900/95 to-black/95 backdrop-blur-md z-50 overflow-hidden"
        >
          <div className="h-full flex flex-col p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-6">
                <motion.button
                  onClick={onBack}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </motion.button>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{artist.name}</h1>
                  <div className="flex items-center space-x-3 text-purple-400">
                    <span>{artist.followers?.total?.toLocaleString()} followers</span>
                    <span>•</span>
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {artist.popularity}% popularity
                    </span>
                  </div>
                </div>
              </div>
              {artist.images?.[0]?.url && (
                <div className="w-32 h-32 rounded-full overflow-hidden">
                  <img
                    src={artist.images[0].url}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Tracks List */}
            <div className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full text-red-400">
                  {error}
                </div>
              ) : (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      itemCount={topTracks.length}
                      itemSize={getItemSize}
                      width={width}
                    >
                      {({ index, style }) => (
                        <div style={style}>
                          <TrackItem
                            track={topTracks[index]}
                            index={index + 1}
                            onClick={() => onTrackSelect(topTracks[index], topTracks)}
                            isPlaying={isPlaying && currentTrack?.id === topTracks[index].id}
                            isSelected={currentTrack?.id === topTracks[index].id}
                            onAddToQueue={onAddToQueue}
                          />
                        </div>
                      )}
                    </List>
                  )}
                </AutoSizer>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ArtistView;
