import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { usePlayerContext } from '../contexts/PlayerContext';

const PlayerNotch = ({ track, onPlayPause, onNext, onPrevious, isPlaying }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isChangingTrack, setIsChangingTrack] = useState(false);
  const [dominantColors, setDominantColors] = useState(['#1a1a2e', '#2a2a4e']);
  const [queueTracks, setQueueTracks] = useState([]);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);

  // Add debounce utility
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

  const debouncedUpdateQueue = useCallback(
    debounce(async () => {
      if (!isExpanded) return;
      
      try {
        const response = await axios.get('/api/spotify/player/state');
        if (response.data?.queue) {
          setQueueTracks(response.data.queue);
        }
      } catch (error) {
        console.debug('Queue update failed:', error);
      }
    }, 300),
    [isExpanded]
  );

  const fetchQueue = useCallback(async () => {
    try {
      const response = await axios.get('/api/spotify/player/state');
      if (response.data?.queue) {
        setQueueTracks(prevTracks => {
          const newTracks = response.data.queue;
          if (prevTracks.length !== newTracks.length || 
              JSON.stringify(prevTracks) !== JSON.stringify(newTracks)) {
            return newTracks;
          }
          return prevTracks;
        });
      }
    } catch (error) {
      console.debug('Queue fetch failed:', error);
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      fetchQueue();
    }
  }, [isExpanded, fetchQueue]);

  useEffect(() => {
    if (isPlaying && track) {
      debouncedUpdateQueue();
    }
  }, [isPlaying, track, debouncedUpdateQueue]);

  const handleTrackChange = async (action) => {
    if (isChangingTrack) return;
    setIsChangingTrack(true);
    await action();
    setTimeout(() => setIsChangingTrack(false), 500);
  };

  const handleNext = () => handleTrackChange(onNext);
  const handlePrevious = () => handleTrackChange(onPrevious);

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

  const handleWheel = (e) => {
    if (!isExpanded) return;
    e.preventDefault();
    e.stopPropagation();
    
    const newPosition = Math.min(
      Math.max(scrollPosition + e.deltaY * 0.5, 0),
      200 
    );
    setScrollPosition(newPosition);
  };

  const handleProgressBarClick = async (e) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const percentage = clickPosition / rect.width;
    const newProgress = Math.floor(percentage * duration);
    await seekToPosition(newProgress);
  };

  const handleProgressBarDrag = async (e) => {
    if (!isDragging || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPosition = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickPosition / rect.width;
    const newProgress = Math.floor(percentage * duration);
    setProgress(newProgress);
  };

  const handleDragEnd = async () => {
    if (isDragging) {
      await seekToPosition(progress);
      setIsDragging(false);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      handleDragEnd();
    };

    const handleMouseMove = (e) => {
      handleProgressBarDrag(e);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleVolumeChange = async (newVolume) => {
    try {
      const response = await axios.put('/api/spotify/player/volume', {
        volume_percent: newVolume
      });
      if (response.status === 200) {
        setVolume(newVolume);
      }
    } catch (error) {
      console.error('Failed to change volume:', error);
    }
  };

  const handleVolumeBarClick = async (e) => {
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const clickPosition = rect.bottom - e.clientY;
    const percentage = Math.max(0, Math.min(100, (clickPosition / rect.height) * 100));
    await handleVolumeChange(Math.round(percentage));
  };

  const handleVolumeBarDrag = async (e) => {
    if (!isDraggingVolume || !volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const clickPosition = rect.bottom - e.clientY;
    const percentage = Math.max(0, Math.min(100, (clickPosition / rect.height) * 100));
    setVolume(Math.round(percentage));
  };

  const handleVolumeDragEnd = async () => {
    if (isDraggingVolume) {
      await handleVolumeChange(volume);
      setIsDraggingVolume(false);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      handleVolumeDragEnd();
    };

    const handleMouseMove = (e) => {
      handleVolumeBarDrag(e);
    };

    if (isDraggingVolume) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVolume]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const seekToPosition = async (position) => {
    try {
      const response = await axios.put('/api/spotify/player/seek', {
        position_ms: position
      });
      if (response.status === 200) {
        setProgress(position);
      }
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };

  const extractColors = useCallback((imageUrl) => {
    if (!imageUrl) return;
    
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.min(img.width, 100);  
      canvas.height = Math.min(img.height, 100);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = [];
      
      const step = Math.max(4 * 100, Math.floor(imageData.length / 50));
      for (let i = 0; i < imageData.length; i += step) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        colors.push(`rgb(${r}, ${g}, ${b})`);
      }
      
      setDominantColors(colors.slice(0, 2));
    };
    
    img.src = imageUrl;
  }, []);

  useEffect(() => {
    if (track?.album?.images[0]?.url) {
      extractColors(track.album.images[0].url);
    }
  }, [track, extractColors]);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= duration) {
            clearInterval(interval);
            return 0;
          }
          return prev + 1000;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  useEffect(() => {
    if (track) {
      setProgress(0);
      setDuration(track.duration_ms);
    }
  }, [track]);

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

  if (!track) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
      onWheel={handleWheel}
    >
      <motion.div
        initial={{ width: '400px', height: '70px', y: 0 }}
        animate={{
          width: isExpanded ? '700px' : '400px',
          height: isExpanded ? '400px' : '70px',
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
        className="backdrop-blur rounded-2xl shadow-xl overflow-hidden border-[3px] border-purple-500/30"
      >
        <motion.div
          style={{ y: isExpanded ? -scrollPosition : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className={`px-6 ${isExpanded ? 'h-[120px]' : 'h-[70px]'} transition-all duration-300 relative`}>
            {isExpanded && (
              <div className="absolute right-2 top-0 bottom-0 w-10 flex items-center justify-center">
                <div className="h-24 w-4 relative">
                  <div 
                    ref={volumeBarRef}
                    className="absolute inset-0 bg-purple-500/20 rounded-full cursor-pointer group"
                    onClick={handleVolumeBarClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsDraggingVolume(true);
                      handleVolumeBarDrag(e);
                    }}
                  >
                    <motion.div 
                      className="absolute bottom-0 left-0 right-0 bg-purple-500/50 rounded-full"
                      style={{ height: `${volume}%` }}
                      whileHover={{ backgroundColor: 'rgba(168, 85, 247, 0.6)' }}
                    >
                      <div 
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </motion.div>
                  </div>
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-purple-400 text-xs">
                    {volume}%
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between h-full">
              <div className={`flex items-center gap-3 ${isExpanded ? 'w-[calc(100%-180px)]' : 'w-[calc(100%-120px)]'}`}>
                <motion.img
                  src={track.album?.images[0]?.url}
                  alt={track.name}
                  animate={{
                    width: isExpanded ? '80px' : '40px',
                    height: isExpanded ? '80px' : '40px',
                  }}
                  transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  className="rounded-lg shadow-md flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <motion.h3 
                    className="font-medium truncate text-white mb-1"
                    animate={{
                      fontSize: isExpanded ? '1.25rem' : '1rem',
                      marginBottom: isExpanded ? '0.25rem' : '0.5rem'
                    }}
                  >
                    {track.name}
                  </motion.h3>
                  <div className="flex flex-col gap-1">
                    <div 
                      className={`relative cursor-pointer group transition-all duration-300 ${isExpanded ? 'h-2' : 'h-1 mb-2'}`}
                    >
                      <div 
                        className="absolute inset-0 bg-purple-500/20 rounded-full"
                        ref={progressBarRef}
                        onClick={handleProgressBarClick}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                          handleProgressBarDrag(e);
                        }}
                      >
                        <motion.div 
                          className="absolute top-0 left-0 h-full bg-purple-500/50 rounded-full"
                          style={{ width: `${(progress / duration) * 100}%` }}
                          whileHover={{ backgroundColor: 'rgba(168, 85, 247, 0.6)' }}
                        >
                          <div 
                            className={`absolute right-0 top-1/2 -translate-y-1/2 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isExpanded ? 'w-3 h-3' : 'w-2.5 h-2.5'}`}
                            style={{ transform: 'translate(50%, -50%)' }}
                          />
                        </motion.div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className={`text-purple-400 text-sm truncate hover:text-purple-300 transition-colors flex-1 pr-4 ${!isExpanded && '-mt-2.5'}`}>
                        {track.artists?.map(a => a.name).join(', ')}
                      </p>
                      {isExpanded && (
                        <p className="text-purple-400 text-sm whitespace-nowrap">
                          {formatTime(progress)} / {formatTime(duration)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <motion.div 
                className="flex items-center gap-2"
                animate={{
                  scale: isExpanded ? 1.2 : 1.1,
                  marginRight: isExpanded ? '48px' : '-1px'
                }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              >
                <button 
                  onClick={handlePrevious}
                  className="p-1.5 hover:bg-purple-500/10 rounded-full transition-colors text-purple-400 hover:text-purple-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                  </svg>
                </button>
                <button 
                  onClick={onPlayPause}
                  className="p-1.5 hover:bg-purple-500/10 rounded-full transition-colors text-purple-400 hover:text-purple-300"
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button 
                  onClick={handleNext}
                  className="p-1.5 hover:bg-purple-500/10 rounded-full transition-colors text-purple-400 hover:text-purple-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
                  </svg>
                </button>
              </motion.div>
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

                    <div className="mt-4 overflow-y-auto">
                      <h4 className="text-sm font-medium text-purple-400 mb-2">Next in queue:</h4>
                      <div className="space-y-2">
                        {queueTracks.slice(0, 5).map((queueTrack, index) => (
                          <div 
                            key={`${queueTrack.id}-${index}`}
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
