import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import TrackItem from '../tracks/TrackItem';
import { uiStateCache, CACHE_DURATION, CACHE_KEYS } from '../../utils/cacheManager';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const AlbumView = ({
  album,
  onBack,
  isAlbumTransition,
  showAlbumView,
  onTrackSelect,
  currentTrack,
  isPlaying,
  onAddToQueue
}) => {
  const [albumTracks, setAlbumTracks] = useState([]);  // Initialize as empty array
  const [albumInfo, setAlbumInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAlbumTracks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const cacheKey = `album:${album.id}:tracks`;
      const cachedData = uiStateCache.get(cacheKey);

      if (cachedData) {
        setAlbumTracks(cachedData.tracks);
        setAlbumInfo(cachedData.albumInfo);
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`/api/spotify/albums/${album.id}/tracks`);
      const { tracks, albumInfo } = response.data;

      uiStateCache.set(cacheKey, { tracks, albumInfo }, CACHE_DURATION.UI_STATE);
      setAlbumTracks(tracks);
      setAlbumInfo(albumInfo);
    } catch (err) {
      console.error('Error fetching album tracks:', err);
      setError('Failed to load album tracks');
    } finally {
      setIsLoading(false);
    }
  }, [album.id]);

  useEffect(() => {
    if (showAlbumView) {
      fetchAlbumTracks();
    }
  }, [showAlbumView, fetchAlbumTracks]);

  const getItemSize = useCallback((index) => {
    return 72; // Height of each track item
  }, []);

  const getTotalDuration = useCallback(() => {
    if (!albumTracks?.length) return 0;
    return Math.round(albumTracks.reduce((acc, track) => acc + track.duration_ms, 0) / 60000);
  }, [albumTracks]);

  return (
    <AnimatePresence>
      {showAlbumView && (
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
                  <h1 className="text-3xl font-bold text-white mb-2">{album.name}</h1>
                  <div className="flex items-center space-x-3 text-purple-400">
                    <span>{album.artists?.map(a => a.name).join(', ')}</span>
                    <span>•</span>
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                      </svg>
                      {albumInfo?.total_tracks} tracks
                    </span>
                    <span>•</span>
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      {getTotalDuration()} min
                    </span>
                    <span>•</span>
                    <span className="px-2 py-1 bg-purple-600/20 rounded-full text-sm">
                      {albumInfo?.release_year || ''}
                    </span>
                  </div>
                </div>
              </div>
              {album.images?.[0]?.url && (
                <div className="w-32 h-32 rounded-lg overflow-hidden">
                  <img
                    src={album.images[0].url}
                    alt={album.name}
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
              ) : albumTracks?.length > 0 ? (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      width={width}
                      itemCount={albumTracks.length}
                      itemSize={getItemSize}
                    >
                      {({ index, style }) => (
                        <div style={style}>
                          <TrackItem
                            track={albumTracks[index]}
                            index={index + 1}
                            onClick={() => onTrackSelect(albumTracks[index], albumTracks)}
                            isPlaying={isPlaying && currentTrack?.id === albumTracks[index].id}
                            isSelected={currentTrack?.id === albumTracks[index].id}
                            onAddToQueue={onAddToQueue}
                          />
                        </div>
                      )}
                    </List>
                  )}
                </AutoSizer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No tracks found
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AlbumView;
