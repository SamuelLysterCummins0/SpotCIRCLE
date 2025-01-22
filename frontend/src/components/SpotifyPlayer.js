import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const SpotifyPlayer = ({ uri, isPlaying: isPlayingProp, onPlayPause, selectedPlaylist, trackPosition }) => {
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [volume, setVolume] = useState(50);
  const lastStateRef = useRef(null);
  const stateTimeoutRef = useRef(null);

  // Helper function to determine if state change is significant
  const isSignificantStateChange = (oldState, newState) => {
    if (!oldState || !newState) return true;

    // Track change
    if (oldState?.track_window?.current_track?.uri !== newState?.track_window?.current_track?.uri) {
      return true;
    }

    // Play/pause state change
    if (oldState.paused !== newState.paused) {
      return true;
    }

    // Position change of more than 1 second
    if (Math.abs(oldState.position - newState.position) > 1000) {
      return true;
    }

    // Duration change of more than 100ms
    if (Math.abs(oldState.duration - newState.duration) > 100) {
      return true;
    }

    return false;
  };

  // Handle player state changes with debouncing
  const handleStateChange = useCallback((state) => {
    if (!state) return;

    // Clear any pending timeout
    if (stateTimeoutRef.current) {
      clearTimeout(stateTimeoutRef.current);
    }

    const lastState = lastStateRef.current;

    // Check if this is a significant state change
    if (isSignificantStateChange(lastState, state)) {
      // Update the last state immediately to prevent duplicate processing
      lastStateRef.current = state;

      // Set a new timeout for UI updates
      stateTimeoutRef.current = setTimeout(() => {
        // Only update UI and log if the state is still current
        if (lastStateRef.current === state) {
          // Only log track changes or play/pause changes
          if (!lastState || 
              lastState?.track_window?.current_track?.uri !== state.track_window.current_track.uri ||
              lastState?.paused !== state.paused) {
            console.log('Player State:', {
              track: state.track_window.current_track.name,
              artist: state.track_window.current_track.artists[0].name,
              paused: state.paused,
              position: state.position,
              duration: state.duration
            });
          }

          setPlayerState(state);
          onPlayPause && onPlayPause(!state.paused);
        }
      }, 16); // Use requestAnimationFrame timing (~16ms) for smoother updates
    }
  }, [onPlayPause]);

  // Handle playback errors
  const handlePlaybackError = useCallback(({ message }) => {
    // Only log errors that aren't about no list being loaded
    if (!message.includes('no list was loaded')) {
      console.error('Failed to perform playback:', message);
      setError('Playback error occurred');
    }
  }, []);

  // Initialize the Spotify Web Playback SDK
  useEffect(() => {
    let isMounted = true;
    let currentPlayer = null;
    
    const initializePlayer = () => {
      // Only initialize if we haven't already
      if (currentPlayer) return currentPlayer;
      
      const player = new window.Spotify.Player({
        name: 'SpotCIRCLE Web Player',
        getOAuthToken: cb => {
          const token = localStorage.getItem('spotify_access_token');
          if (token) {
            cb(token);
          } else {
            refreshToken();
          }
        },
        volume: volume / 100
      });

      // Error handling
      player.addListener('initialization_error', ({ message }) => {
        console.error('Failed to initialize:', message);
        if (isMounted) setError('Failed to initialize player');
      });

      player.addListener('authentication_error', ({ message }) => {
        console.error('Failed to authenticate:', message);
        refreshToken();
      });

      player.addListener('account_error', ({ message }) => {
        console.error('Failed to validate Spotify account:', message);
        if (isMounted) setError('Premium account required');
      });

      player.addListener('playback_error', handlePlaybackError);

      player.addListener('player_state_changed', handleStateChange);

      // Ready handling
      player.addListener('ready', ({ device_id }) => {
        console.log('The Web Playback SDK is ready with device ID:', device_id);
        if (!isMounted) return;
        
        setDeviceId(device_id);
        setIsReady(true);
        setPlayer(player);
        
        // Store device ID globally
        window.spotifyWebPlaybackDeviceId = device_id;

        // Check if device is ready before transfer
        const checkDeviceReady = async (token) => {
          try {
            const response = await axios.get(`${API_URL}/api/spotify/player/devices`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data.devices.some(d => d.id === device_id);
          } catch (error) {
            return false;
          }
        };

        // Transfer playback to this device
        const transferPlayback = async () => {
          try {
            const token = localStorage.getItem('spotify_access_token');
            if (!token) {
              throw new Error('No access token available');
            }

            // Wait for device to be ready (max 3 attempts)
            let deviceReady = false;
            for (let i = 0; i < 3; i++) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              deviceReady = await checkDeviceReady(token);
              if (deviceReady) break;
            }

            if (!deviceReady) {
              // Device not ready yet, but that's okay - it will be ready when needed
              return;
            }
            
            // Only transfer if we're not already active
            const response = await axios.get(`${API_URL}/api/spotify/player/current`, {
              headers: { 'Authorization': `Bearer ${token}` }
            }).catch(error => {
              if (error.response?.status === 204) {
                return { data: { device: null } };
              }
              throw error;
            });
            
            const currentDevice = response.data?.device?.id;
            if (currentDevice !== device_id) {
              await axios.put(`${API_URL}/api/spotify/player`, {
                deviceId: device_id
              }, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
            }
          } catch (error) {
            // Only log if it's not a 204 response or device already active
            if (error.response?.status !== 204 && 
                !(error.response?.data?.message === 'Device already active')) {
              // Don't log the initial setup error
              if (error.response?.status !== 400 || window.spotifyHasPlayedTrack) {
                console.warn('Device transfer not completed, will retry when playing:', 
                  error.response?.status === 400 ? 'Device not ready' : error.message
                );
              }
            }
          }
        };

        // Initial transfer attempt
        transferPlayback().catch(() => {
          // Silently fail - we'll retry when playing
        });
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline:', device_id);
        if (!isMounted) return;
        
        setIsReady(false);
        window.spotifyWebPlaybackDeviceId = null;
      });

      // Connect to the player
      if (!player.isConnected) {
        console.log('Connecting to Spotify Web Playback SDK...');
        player.connect().then(success => {
          if (!isMounted) return;
          
          if (success) {
            console.log('Successfully connected to Spotify Web Playback SDK');
            setPlayer(player);
          } else {
            console.error('Failed to connect to Spotify Web Playback SDK');
            setError('Failed to connect to Spotify');
          }
        });
      }

      currentPlayer = player;
      return player;
    };

    // Check if script is already loaded
    if (window.Spotify) {
      const player = initializePlayer();
      return () => {
        isMounted = false;
        if (player) {
          player.disconnect();
        }
      };
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = initializePlayer();
    };

    return () => {
      isMounted = false;
      if (currentPlayer) {
        currentPlayer.disconnect();
      }
    };
  }, []); // Empty dependency array since we only want to initialize once

  // Handle token refresh
  const refreshToken = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/refresh`, { withCredentials: true });
      if (response.data.access_token) {
        localStorage.setItem('spotify_access_token', response.data.access_token);
        window.location.reload();
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      setError('Authentication failed');
    }
  };

  // Handle play/pause
  useEffect(() => {
    if (!player || !isReady || !deviceId) return;

    const handlePlayback = async () => {
      try {
        // Get current state to check if we have a track loaded
        const state = await player.getCurrentState();
        if (!state && isPlayingProp) return;

        // Check if we're already in the desired state
        if (state?.paused === !isPlayingProp) return;

        if (isPlayingProp) {
          await player.resume();
        } else {
          await player.pause();
        }
      } catch (error) {
        if (!error.message?.includes('no list was loaded')) {
          console.error('Error controlling playback:', error);
          setError('Failed to control playback');
        }
      }
    };

    // Small delay to allow for state updates
    const timeoutId = setTimeout(handlePlayback, 50);
    return () => clearTimeout(timeoutId);
  }, [isPlayingProp, player, isReady, deviceId]);

  // Handle volume changes
  useEffect(() => {
    if (!player || !isReady) return;
    
    player.setVolume(volume / 100).catch(error => {
      console.error('Error setting volume:', error);
    });
  }, [volume, player, isReady]);

  // Handle URI changes
  useEffect(() => {
    if (!player || !isReady || !selectedPlaylist || !trackPosition) return;

    const playTrack = async () => {
      try {
        // Mark that we've played a track
        window.spotifyHasPlayedTrack = true;
        
        const response = await axios.get(`/api/spotify/playlists/${selectedPlaylist}/tracks`);
        const tracks = response.data;
        
        if (!tracks || tracks.length === 0) {
          console.error('No tracks found in playlist');
          return;
        }

        const track = tracks[trackPosition];
        if (!track) {
          console.error('Track not found at position:', trackPosition);
          return;
        }

        await player.resume();
      } catch (error) {
        console.error('Failed to play track:', error);
        setError('Failed to play track');
      }
    };

    playTrack();
  }, [selectedPlaylist, trackPosition, player, isReady]);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  // The player is invisible but functional
  return null;
};

export default SpotifyPlayer;
