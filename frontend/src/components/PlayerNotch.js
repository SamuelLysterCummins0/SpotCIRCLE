import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const PlayerNotch = ({ track, onPlayPause, onNext, onPrevious, isPlaying }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isChangingTrack, setIsChangingTrack] = useState(false);
  const [dominantColors, setDominantColors] = useState(['#1a1a2e', '#2a2a4e']);
  const [queueTracks, setQueueTracks] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (track?.album?.images[0]?.url) {
      extractColors(track.album.images[0].url);
    }
  }, [track]);

  // Fetch queue when track changes
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/spotify/player/current', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
          }
        });

        if (response.data?.queue) {
          setQueueTracks(response.data.queue);
        }
      } catch (error) {
        console.warn('Failed to fetch queue:', error);
      }
    };

    if (track) {
      fetchQueue();
    }
  }, [track]);

  useEffect(() => {
    const handleGlobalScroll = (e) => {
      if (isExpanded && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (
          e.clientX >= rect.left && 
          e.clientX <= rect.right && 
          e.clientY >= rect.top && 
          e.clientY <= rect.bottom
        ) {
          const newPosition = Math.min(
            Math.max(scrollPosition + e.deltaY * 0.5, 0),
            200
          );
          setScrollPosition(newPosition);
        }
      }
    };

    if (isExpanded) {
      window.addEventListener('wheel', handleGlobalScroll);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      window.removeEventListener('wheel', handleGlobalScroll);
      document.body.style.overflow = 'auto';
    };
  }, [isExpanded, scrollPosition]);

  const handleTrackChange = async (action) => {
    setIsChangingTrack(true);
    await action();
    setTimeout(() => setIsChangingTrack(false), 500);
  };

  const extractColors = (imageUrl) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = [];
      
      for (let i = 0; i < imageData.length; i += 4 * 1000) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        colors.push(`rgb(${r}, ${g}, ${b})`);
      }
      
      setDominantColors(colors.slice(0, 3));
    };
  };

  if (!track) return null;

  const handleWheel = (e) => {
    if (!isExpanded) return;
    const newPosition = Math.min(
      Math.max(scrollPosition + e.deltaY * 0.5, 0),
      200
    );
    setScrollPosition(newPosition);
  };

  const discVariants = {
    normal: { 
      rotateY: 0,
      scale: 1,
      transition: { duration: 0.5 }
    },
    changing: { 
      rotateY: 180,
      scale: 0.8,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
      onWheel={handleWheel}
    >
      <motion.div
        initial={{ width: '400px', height: '60px', y: 0 }}
        animate={{
          width: isExpanded ? '600px' : '400px',
          height: isExpanded ? '300px' : '60px',
          y: 0
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        onHoverStart={() => setIsExpanded(true)}
        onHoverEnd={() => {
          setIsExpanded(false);
          setScrollPosition(0);
        }}
        style={{
          background: `linear-gradient(135deg, ${dominantColors.join(', ')})`
        }}
        className="backdrop-blur rounded-2xl shadow-xl overflow-hidden border-2 border-purple-500/30"
      >
        <motion.div
          style={{ y: isExpanded ? -scrollPosition : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Collapsed/Expanded view container */}
          <div className="h-[60px] flex items-center px-6 justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <img
                src={track.album?.images[0]?.url}
                alt={track.name}
                className="w-10 h-10 rounded-lg shadow-md"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-base truncate text-white">{track.name}</h3>
                <p className="text-purple-400 text-sm truncate hover:text-purple-300 transition-colors">
                  {track.artists?.map(a => a.name).join(', ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleTrackChange(onPrevious)}
                className="p-2 hover:bg-purple-500/10 rounded-full transition-colors text-purple-400 hover:text-purple-300"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                </svg>
              </button>
              <button 
                onClick={onPlayPause}
                className="p-2 hover:bg-purple-500/10 rounded-full transition-colors text-purple-400 hover:text-purple-300"
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
                onClick={() => handleTrackChange(onNext)}
                className="p-2 hover:bg-purple-500/10 rounded-full transition-colors text-purple-400 hover:text-purple-300"
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
                className="p-6 overflow-hidden"
              >
                <div className="flex gap-6">
                  {/* Spinning vinyl with album art */}
                  <motion.div 
                    className="relative w-48 h-48 flex-shrink-0 perspective-1000"
                    variants={discVariants}
                    animate={isChangingTrack ? 'changing' : 'normal'}
                  >
                    <motion.div
                      className="relative w-full h-full"
                      animate={{ rotate: isPlaying ? 360 : 0 }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    >
                      {/* Vinyl grooves */}
                      <div className="absolute inset-0 rounded-full bg-gray-200">
                        {[...Array(8)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute inset-0 rounded-full border border-gray-400/30"
                            style={{
                              transform: `scale(${1 - (i * 0.1)})`,
                            }}
                          />
                        ))}
                      </div>
                      {/* Album art */}
                      <motion.div 
                        className="absolute inset-0 rounded-full overflow-hidden"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: isChangingTrack ? 0 : 1 }}
                        transition={{ duration: 0.25 }}
                      >
                        <img
                          src={track.album?.images[0]?.url}
                          alt={track.name}
                          className="w-full h-full object-cover"
                        />
                      </motion.div>
                      {/* Center hole */}
                      <div className="absolute inset-[30%] rounded-full bg-gradient-to-br from-gray-800 to-black border-4 border-gray-300">
                        <div className="absolute inset-0 rounded-full border border-gray-400/30" />
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Track info and queue */}
                  <div className="flex-1">
                    <div>
                      <h3 className="font-bold text-xl truncate text-white">{track.name}</h3>
                      <p className="text-purple-400 text-base truncate hover:text-purple-300 transition-colors">
                        {track.artists?.map(a => a.name).join(', ')}
                      </p>
                      <p className="text-purple-500/50 text-sm mt-2">
                        {track.album?.name}
                      </p>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-purple-400 mb-2">Next in queue:</h4>
                      <div className="space-y-2">
                        {queueTracks.slice(0, 5).map((queueTrack, index) => (
                          <div 
                            key={queueTrack.id || index} 
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-purple-500/5 transition-colors"
                          >
                            <div className="w-8 h-8 rounded shadow-sm overflow-hidden">
                              <img
                                src={queueTrack.album?.images[0]?.url || '/default-album.png'}
                                alt={queueTrack.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate text-white">{queueTrack.name}</p>
                              <p className="text-xs text-purple-400 truncate">
                                {queueTrack.artists?.map(a => a.name).join(', ')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PlayerNotch;
