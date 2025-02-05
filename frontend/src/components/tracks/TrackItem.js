import React, { useState } from 'react';
import { motion } from 'framer-motion';

const TrackItem = ({ track, onClick, isPlaying, index, onAddToQueue }) => {
  const [isQueueAnimating, setIsQueueAnimating] = useState(false);

  const handleQueueClick = (e) => {
    e.stopPropagation();
    setIsQueueAnimating(true);
    onAddToQueue(track, e);
    setTimeout(() => setIsQueueAnimating(false), 1000);
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  return (
    <motion.div
      className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors relative w-full"
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
        {track && track.artists && Array.isArray(track.artists) ? (
          <motion.p 
            className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors"
            initial={{ opacity: 0.7 }}
            whileHover={{ opacity: 1 }}
          >
            {track.artists.filter(a => a && a.name).map(a => a.name).join(', ')}
          </motion.p>
        ) : (
          <motion.p 
            className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors"
            initial={{ opacity: 0.7 }}
            whileHover={{ opacity: 1 }}
          >
            Unknown Artist
          </motion.p>
        )}
      </div>
      <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <motion.button
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleQueueClick}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        </motion.button>
        <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
          {formatDuration(track.duration_ms)}
        </div>
      </div>
    </motion.div>
  );
};

export default TrackItem;
