import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { usePlayerContext } from '../../contexts/PlayerContext';

const PlayerNotch = ({ track, onPlayPause, onNext, onPrevious, isPlaying }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isChangingTrack, setIsChangingTrack] = useState(false);
  const [dominantColors, setDominantColors] = useState(['#1a1a2e', '#2a2a4e', '#3a3a6e', '#4a4a8e']);
  const [queueTracks, setQueueTracks] = useState([]);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [textColors, setTextColors] = useState({
    primary: 'white',
    secondary: 'rgba(255, 255, 255, 0.7)',
    button: 'white'
  });
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);
  const [isInitialMount, setIsInitialMount] = useState(true);

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

  const calculateLuminance = (r, g, b) => {
    const rs = r / 255;
    const gs = g / 255;
    const bs = b / 255;
    
    const r1 = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    const g1 = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    const b1 = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    
    return 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
  };

  const shouldUseWhiteText = (backgroundColor) => {
    const rgb = backgroundColor.match(/\d+/g).map(Number);
    const luminance = calculateLuminance(rgb[0], rgb[1], rgb[2]);
    return luminance < 0.5;
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

  useEffect(() => {
    if (dominantColors.length > 0) {
      const primaryColor = dominantColors[0];
      const useWhite = shouldUseWhiteText(primaryColor);
      
      setTextColors({
        primary: useWhite ? 'white' : 'rgba(0, 0, 0, 0.87)',
        secondary: useWhite ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.75)',
        button: useWhite ? 'white' : 'rgba(0, 0, 0, 0.87)'
      });
    }
  }, [dominantColors]);

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

  const handleProgressTouchStart = (e) => {
    setIsDragging(true);
    handleProgressBarClick(e.touches[0]);
  };

  const handleProgressTouchMove = (e) => {
    if (isDragging) {
      handleProgressBarDrag(e);
    }
  };

  const handleProgressTouchEnd = () => {
    handleDragEnd();
  };

  const handleVolumeTouchStart = (e) => {
    setIsDraggingVolume(true);
    handleVolumeBarClick(e.touches[0]);
  };

  const handleVolumeTouchMove = (e) => {
    if (isDraggingVolume) {
      handleVolumeBarDrag(e);
    }
  };

  const handleVolumeTouchEnd = () => {
    handleVolumeDragEnd();
  };

  const handleProgressBarClick = async (e) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPosition = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickPosition / rect.width;
    const newProgress = Math.min(Math.floor(percentage * duration), duration);
    setProgress(newProgress);
    await seekToPosition(newProgress);
  };

  const handleProgressBarDrag = (e) => {
    if (!isDragging || !progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clickPosition = Math.max(0, Math.min(x - rect.left, rect.width));
    const percentage = clickPosition / rect.width;
    const newProgress = Math.min(Math.floor(percentage * duration), duration);
    
    // Update immediately for smoother visual feedback
    setProgress(newProgress);
    
    // Debounce the actual seek operation
    debouncedSeek(newProgress);
  };

  const debouncedSeek = useCallback(
    debounce((position) => {
      seekToPosition(position);
    }, 50),
    []
  );

  const handleVolumeBarClick = async (e) => {
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const clickPosition = Math.max(0, Math.min(rect.bottom - e.clientY, rect.height));
    const percentage = Math.max(0, Math.min(100, (clickPosition / rect.height) * 100));
    await handleVolumeChange(Math.round(percentage));
  };

  const handleVolumeBarDrag = (e) => {
    if (!isDraggingVolume || !volumeBarRef.current) return;
    
    const rect = volumeBarRef.current.getBoundingClientRect();
    const y = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const clickPosition = Math.max(0, Math.min(rect.bottom - y, rect.height));
    const percentage = Math.max(0, Math.min(100, (clickPosition / rect.height) * 100));
    const newVolume = Math.round(percentage);
    
    // Update immediately for smoother visual feedback
    setVolume(newVolume);
    
    // Debounce the actual volume change
    debouncedVolumeChange(newVolume);
  };

  const debouncedVolumeChange = useCallback(
    debounce((newVolume) => {
      handleVolumeChange(newVolume);
    }, 50),
    []
  );

  useEffect(() => {
    let interval;
    if (isPlaying && !isDragging && track) {
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 1000;
          // Don't exceed track duration
          if (newProgress >= duration) {
            clearInterval(interval);
            return duration;
          }
          return newProgress;
        });
      }, 1000); // Update every second
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, isDragging, duration, track]);

  useEffect(() => {
    if (track) {
      setProgress(0);
      setDuration(track.duration_ms);
    }
  }, [track?.uri]); // Only reset when track URI changes

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

  const handleVolumeDragEnd = async () => {
    if (isDraggingVolume) {
      await handleVolumeChange(volume);
      setIsDraggingVolume(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        handleProgressBarDrag(e);
      } else if (isDraggingVolume) {
        handleVolumeBarDrag(e);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
      if (isDraggingVolume) {
        setIsDraggingVolume(false);
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault(); // Prevent scrolling while dragging
      if (isDragging) {
        handleProgressBarDrag(e);
      } else if (isDraggingVolume) {
        handleVolumeBarDrag(e);
      }
    };

    if (isDragging || isDraggingVolume) {
      window.addEventListener('mousemove', handleMouseMove, { passive: false });
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, isDraggingVolume]);

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
    if (!imageUrl) {
      setDominantColors(['#1a1a2e', '#2a2a4e', '#3a3a6e', '#4a4a8e']);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onerror = () => {
      setDominantColors(['#1a1a2e', '#2a2a4e', '#3a3a6e', '#4a4a8e']);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.min(img.width, 64);
        canvas.height = Math.min(img.height, 64);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const colorCounts = new Map();
        let totalPixels = 0;
        let colorfulPixels = 0;
        let totalR = 0, totalG = 0, totalB = 0;

        // First pass: collect colors and calculate statistics
        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];

          if (a < 128) continue;

          totalPixels++;
          totalR += r;
          totalG += g;
          totalB += b;

          // Check if pixel is colorful
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const diff = max - min;
          const sat = max === 0 ? 0 : diff / max;
          const isGrayish = sat < 0.15;
          
          if (!isGrayish) {
            colorfulPixels++;
          }

          // Skip very light or very dark colors unless they're dominant
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if ((brightness < 30 || brightness > 225) && sat < 0.15) continue;

          // Quantize colors
          const key = `${Math.round(r/8)*8},${Math.round(g/8)*8},${Math.round(b/8)*8}`;
          colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
        }

        // Calculate if image is mostly colorful or grayscale
        const isColorfulImage = colorfulPixels / totalPixels > 0.2;

        // Convert to array and sort by frequency
        const sortedColors = Array.from(colorCounts.entries())
          .map(([key, count]) => {
            const [r, g, b] = key.split(',').map(Number);
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            
            // Calculate score based on color properties
            let score = count;
            if (isColorfulImage) {
              // Boost saturated colors in colorful images
              score *= (1 + sat);
              // Penalize very light/dark colors unless they're very common
              if (brightness < 30 || brightness > 225) {
                score *= 0.7;
              }
            } else {
              // In grayscale images, prioritize good contrast
              score *= (1 - Math.abs(brightness - 128) / 128);
            }

            return { r, g, b, count, score, sat, brightness };
          })
          .sort((a, b) => b.score - a.score);

        // Get average color for mixing
        const avgR = Math.round(totalR / totalPixels);
        const avgG = Math.round(totalG / totalPixels);
        const avgB = Math.round(totalB / totalPixels);

        // Get top colors ensuring good contrast
        const finalColors = [];
        for (const color of sortedColors) {
          if (finalColors.length >= 4) break;

          // Mix with average color if the saturation is too low
          let finalR = color.r, finalG = color.g, finalB = color.b;
          if (color.sat < 0.15 && isColorfulImage) {
            const mixFactor = 0.7;
            finalR = Math.round(color.r * mixFactor + avgR * (1 - mixFactor));
            finalG = Math.round(color.g * mixFactor + avgG * (1 - mixFactor));
            finalB = Math.round(color.b * mixFactor + avgB * (1 - mixFactor));
          }

          // Check if this color is different enough from existing colors
          const isDifferent = finalColors.every(existing => {
            const deltaR = Math.abs(existing.r - finalR);
            const deltaG = Math.abs(existing.g - finalG);
            const deltaB = Math.abs(existing.b - finalB);
            return (deltaR + deltaG + deltaB) > 60;
          });

          if (isDifferent) {
            finalColors.push({ r: finalR, g: finalG, b: finalB });
          }
        }

        // If we don't have enough colors, generate variations
        while (finalColors.length < 4) {
          const baseColor = finalColors[0] || { r: 26, g: 26, b: 46 };
          const variation = finalColors.length % 2 === 0 ? 1.2 : 0.8;
          finalColors.push({
            r: Math.min(255, Math.round(baseColor.r * variation)),
            g: Math.min(255, Math.round(baseColor.g * variation)),
            b: Math.min(255, Math.round(baseColor.b * variation))
          });
        }

        const newColors = finalColors.map(c => `rgb(${c.r}, ${c.g}, ${c.b})`);
        setDominantColors(newColors);
      } catch (error) {
        setDominantColors(['#1a1a2e', '#2a2a4e', '#3a3a6e', '#4a4a8e']);
      }
    };

    img.src = imageUrl;
  }, []);

  useEffect(() => {
    if (isInitialMount && track?.album?.images?.[0]?.url) {
      extractColors(track.album.images[0].url);
      setIsInitialMount(false);
    }
  }, [isInitialMount, track]);

  const rgbToHsl = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      
      h /= 6;
    }

    return [h, s, l];
  };

  // Track reference for memoization
  const trackRef = useRef(track);
  const lastImageUrlRef = useRef(null);
  const extractionTimeoutRef = useRef(null);

  // Memoize track info to prevent unnecessary re-renders
  const trackInfo = React.useMemo(() => {
    if (!track) return null;
    return {
      name: track.name || '',
      artist: track.artists?.[0]?.name || '',
      imageUrl: track.album?.images?.[0]?.url || '',
      duration: track.duration_ms || 0
    };
  }, [track?.uri]); // Only update when track URI changes

  // Optimize color extraction timing
  useEffect(() => {
    if (!track?.album?.images?.[0]?.url) return;
    
    const imageUrl = track.album.images[0].url;
    if (imageUrl === lastImageUrlRef.current) return;
    
    // Clear any pending extraction
    if (extractionTimeoutRef.current) {
      clearTimeout(extractionTimeoutRef.current);
    }

    // Update reference immediately for fast switching
    lastImageUrlRef.current = imageUrl;
    trackRef.current = track;

    // Delay color extraction slightly to prioritize UI update
    extractionTimeoutRef.current = setTimeout(() => {
      if (trackRef.current === track) {
        extractColors(imageUrl);
      }
    }, 100);

    return () => {
      if (extractionTimeoutRef.current) {
        clearTimeout(extractionTimeoutRef.current);
      }
    };
  }, [track?.uri, extractColors]);

  // Optimize progress updates
  const updateProgress = useCallback(
    debounce((newProgress) => {
      if (trackRef.current === track) {
        setProgress(newProgress);
      }
    }, 50),
    [track?.uri]
  );

  const handleDragEnd = async () => {
    if (isDragging) {
      await seekToPosition(progress);
      setIsDragging(false);
    }
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
          '--gradient-colors': dominantColors.length > 0 
            ? `135deg, ${[...dominantColors, dominantColors[0]].join(', ')}`
            : '135deg, #1a1a2e, #2a2a4e, #3a3a6e, #4a4a8e',
          outline: '4px solid rgba(192, 132, 252, 0.6)',
          outlineOffset: '0px'
        }}
        className={`backdrop-blur rounded-2xl shadow-xl overflow-hidden ${dominantColors.length > 0 ? 'animated-gradient' : 'static-gradient'}`}
      >
        <style>{`
          .animated-gradient {
            background: linear-gradient(var(--gradient-colors));
            background-size: 250% 250%;
            animation: gradientFlow 8s ease infinite;
          }
          .static-gradient {
            background: linear-gradient(var(--gradient-colors));
            background-size: 250% 250%;
          }
          @keyframes gradientFlow {
            0% { background-position: 0% 0%; }
            50% { background-position: 100% 100%; }
            100% { background-position: 0% 0%; }
          }
        `}</style>
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
                    onTouchStart={handleVolumeTouchStart}
                    onTouchMove={handleVolumeTouchMove}
                    onTouchEnd={handleVolumeTouchEnd}
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
                  className={`rounded-lg shadow-md flex-shrink-0 ${!isExpanded && '-mt-1.47 -ml-1.5'}`}
                />
                <div className={`min-w-0 flex-1 ${!isExpanded && '-mt-2'}`}>
                  <motion.h3 
                    className="font-medium truncate text-white mb-1"
                    animate={{
                      fontSize: isExpanded ? '1.25rem' : '1rem',
                      marginBottom: isExpanded ? '0.25rem' : '0.5rem'
                    }}
                    style={{
                      color: textColors.primary,
                      fontWeight: textColors.primary === 'white' ? '600' : '700'
                    }}
                  >
                    {track.name}
                  </motion.h3>
                  <div className="flex flex-col gap-1">
                    <div 
                      className={`relative cursor-pointer group transition-all duration-300 ${isExpanded ? 'h-2' : 'h-1 mb-2'}`}
                    >
                      <div 
                        ref={progressBarRef}
                        className="absolute inset-0 bg-purple-500/20 rounded-full"
                        onClick={handleProgressBarClick}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                          handleProgressBarDrag(e);
                        }}
                        onTouchStart={handleProgressTouchStart}
                        onTouchMove={handleProgressTouchMove}
                        onTouchEnd={handleProgressTouchEnd}
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
                      <p className={`text-purple-400 text-sm truncate hover:text-purple-300 transition-colors flex-1 pr-4 ${!isExpanded && '-mt-2.5'}`} style={{ 
                        color: textColors.secondary,
                        fontWeight: textColors.primary === 'white' ? '400' : '500'
                      }}>
                        {track.artists?.map(a => a.name).join(', ')}
                      </p>
                      {isExpanded && (
                        <p className="text-purple-400 text-sm whitespace-nowrap" style={{ 
                          color: textColors.secondary,
                          fontWeight: textColors.primary === 'white' ? '400' : '500'
                        }}>
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
                  className="p-1.5 hover:bg-purple-500/10 rounded-full transition-colors" style={{ 
                    color: textColors.button,
                    fontWeight: textColors.primary === 'white' ? '400' : '500'
                  }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                  </svg>
                </button>
                <button 
                  onClick={onPlayPause}
                  className="p-1.5 hover:bg-purple-500/10 rounded-full transition-colors" style={{ 
                    color: textColors.button,
                    fontWeight: textColors.primary === 'white' ? '400' : '500'
                  }}
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
                  className="p-1.5 hover:bg-purple-500/10 rounded-full transition-colors" style={{ 
                    color: textColors.button,
                    fontWeight: textColors.primary === 'white' ? '400' : '500'
                  }}
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
                      <h3 className="font-bold text-xl truncate text-white" style={{ 
                        color: textColors.primary,
                        fontWeight: textColors.primary === 'white' ? '600' : '700'
                      }}>{track.name}</h3>
                      <p className="text-purple-400 text-base truncate hover:text-purple-300 transition-colors" style={{ 
                        color: textColors.secondary,
                        fontWeight: textColors.primary === 'white' ? '400' : '500'
                      }}>
                        {track.artists?.map(a => a.name).join(', ')}
                      </p>
                      <p className="text-purple-500/50 text-sm mt-2" style={{ 
                        color: textColors.secondary,
                        fontWeight: textColors.primary === 'white' ? '400' : '500'
                      }}>
                        {track.album?.name}
                      </p>
                    </div>

                    <div className="mt-4 overflow-y-auto">
                      <h4 className="text-sm font-medium text-purple-400 mb-2" style={{ 
                        color: textColors.secondary,
                        fontWeight: textColors.primary === 'white' ? '400' : '500'
                      }}>Next in queue:</h4>
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
                              <p className="text-sm truncate text-white" style={{ 
                                color: textColors.primary,
                                fontWeight: textColors.primary === 'white' ? '600' : '700'
                              }}>{queueTrack.name}</p>
                              <p className="text-xs text-purple-400 truncate" style={{ 
                                color: textColors.secondary,
                                fontWeight: textColors.primary === 'white' ? '400' : '500'
                              }}>
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
