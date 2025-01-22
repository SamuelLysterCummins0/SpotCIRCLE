import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const previousTrackRef = useRef(null);
  const transitionTimeoutRef = useRef(null);

  const updateCurrentTrack = useCallback((track) => {
    if (!track) return;
    
    // Don't update if it's the same track
    if (currentTrack?.id === track.id) {
      return;
    }
    
    // Clear any pending transitions
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Store the previous track
    previousTrackRef.current = currentTrack;

    // Update the current track immediately
    setCurrentTrack(track);
  }, [currentTrack]);

  const value = {
    currentTrack,
    previousTrack: previousTrackRef.current,
    updateCurrentTrack,
    isPlaying,
    setIsPlaying,
    queue,
    setQueue
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext must be used within a PlayerProvider');
  }
  return context;
};
