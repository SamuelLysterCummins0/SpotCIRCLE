import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PlayerNotch = ({ track, onPlayPause, onNext, onPrevious, isPlaying, queue }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!track) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        initial={{ width: '400px', height: '60px', y: 0 }}
        animate={{
          width: isExpanded ? '600px' : '400px',
          height: isExpanded ? '300px' : '60px',
          y: 0
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        onHoverStart={() => setIsExpanded(true)}
        onHoverEnd={() => setIsExpanded(false)}
        className="bg-gray-900/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden border border-purple-500/20"
      >
        {/* Collapsed view */}
        <div className="h-[60px] flex items-center px-6 justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <img
              src={track.album?.images[0]?.url}
              alt={track.name}
              className="w-10 h-10 rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-base truncate">{track.name}</h3>
              <p className="text-gray-400 text-sm truncate">
                {track.artists.map(a => a.name).join(', ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onPrevious}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
              </svg>
            </button>
            <button 
              onClick={onPlayPause}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <button 
              onClick={onNext}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expanded view */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <div className="flex gap-6">
                {/* Spinning vinyl with album art */}
                <motion.div 
                  className="relative w-48 h-48"
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute inset-0 rounded-full bg-black/20 backdrop-blur" />
                  <img
                    src={track.album?.images[0]?.url}
                    alt={track.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                  <div className="absolute inset-1/4 rounded-full bg-gray-900/50 backdrop-blur" />
                </motion.div>

                {/* Track info and queue */}
                <div className="flex-1">
                  <div>
                    <h3 className="font-bold text-xl truncate">{track.name}</h3>
                    <p className="text-gray-400 text-base truncate">
                      {track.artists.map(a => a.name).join(', ')}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      {track.album?.name}
                    </p>
                  </div>

                  {queue.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Next in queue:</h4>
                      <div className="space-y-2">
                        {queue.slice(0, 3).map((queuedTrack) => (
                          <div key={queuedTrack.id} className="flex items-center gap-2">
                            <img
                              src={queuedTrack.album?.images[0]?.url}
                              alt={queuedTrack.name}
                              className="w-8 h-8 rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{queuedTrack.name}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {queuedTrack.artists.map(a => a.name).join(', ')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default PlayerNotch;
