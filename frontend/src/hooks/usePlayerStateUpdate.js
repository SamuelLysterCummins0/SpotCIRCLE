import { useMemo, useEffect } from 'react';
import debounce from 'lodash/debounce';

/**
 * Custom hook for managing debounced player state updates
 * @param {Function} updatePlayerState - Function to update the player state
 * @param {boolean} isPlaying - Whether the player is currently playing
 * @param {Object} options - Optional configuration
 * @param {number} options.debounceMs - Debounce wait time in ms (default: 500)
 * @param {number} options.maxWaitMs - Maximum wait time in ms (default: 1000)
 * @param {number} options.checkIntervalMs - How often to check for updates in ms (default: 300)
 * @returns {Function} The debounced update function
 */
export const usePlayerStateUpdate = (
  updatePlayerState,
  isPlaying,
  {
    debounceMs = 500,
    maxWaitMs = 1000,
    checkIntervalMs = 300
  } = {}
) => {
  // Create a debounced version of the update function
  const debouncedUpdateState = useMemo(() => {
    return debounce(async () => {
      await updatePlayerState();
    }, debounceMs, { 
      leading: false,     // Don't execute on the first call
      trailing: true,     // Execute after the wait period
      maxWait: maxWaitMs // Ensure we execute at least every maxWaitMs
    });
  }, [updatePlayerState, debounceMs, maxWaitMs]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    
    // Initial update
    updatePlayerState();

    // Then set up interval for subsequent updates
    const interval = setInterval(() => {
      debouncedUpdateState();
    }, checkIntervalMs);

    return () => {
      clearInterval(interval);
      debouncedUpdateState.cancel();
    };
  }, [isPlaying, debouncedUpdateState, updatePlayerState, checkIntervalMs]);

  return debouncedUpdateState;
};
