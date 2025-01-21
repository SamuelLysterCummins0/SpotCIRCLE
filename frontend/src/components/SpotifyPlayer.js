import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const SpotifyPlayer = ({ uri, isPlaying: isPlayingProp, onPlayPause, selectedPlaylist, trackPosition }) => {
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [volume, setVolume] = useState(50);

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

      // State management
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

        // Transfer playback to this device
        const transferPlayback = async () => {
          try {
            const token = localStorage.getItem('spotify_access_token');
            await axios.put(`${API_URL}/api/spotify/player`, {
              deviceId: device_id
            }, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            console.log('Successfully transferred playback to device:', device_id);
          } catch (error) {
            console.error('Error transferring playback:', error);
          }
        };
        transferPlayback();
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

  // Handle player state changes
  const handleStateChange = (state) => {
    if (state) {
      // Only log state changes that are meaningful
      if (!playerState || 
          state.paused !== playerState.paused ||
          state.position !== playerState.position ||
          state.track_window?.current_track?.uri !== playerState?.track_window?.current_track?.uri) {
        console.log('Player State:', {
          track: state.track_window.current_track.name,
          artist: state.track_window.current_track.artists[0].name,
          paused: state.paused,
          position: state.position,
          duration: state.duration
        });
      }
      
      // Only update if the state actually changed
      if (!playerState || 
          state.paused !== playerState.paused || 
          state.track_window?.current_track?.uri !== playerState?.track_window?.current_track?.uri) {
        setPlayerState(state);
        onPlayPause && onPlayPause(!state.paused);
      }
    }
  };

  // Handle playback errors
  const handlePlaybackError = ({ message }) => {
    // Only log errors that aren't about no list being loaded
    if (!message.includes('no list was loaded')) {
      console.error('Failed to perform playback:', message);
      setError('Playback error occurred');
    }
  };

  // Handle play/pause
  useEffect(() => {
    if (!player || !isReady || !deviceId) return;

    const handlePlayback = async () => {
      try {
        // Get current state to check if we have a track loaded
        const state = await player.getCurrentState();
        if (!state && isPlayingProp) {
          // No track loaded, don't try to resume
          return;
        }

        if (isPlayingProp) {
          const resumeSuccess = await player.resume().catch(e => {
            console.error('Resume failed:', e);
            return false;
          });
          
          if (!resumeSuccess) {
            console.log('Falling back to API call for resume');
            await axios.put(`${API_URL}/api/spotify/player/play`, null, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
              }
            });
          }
        } else {
          const pauseSuccess = await player.pause().catch(e => {
            console.error('Pause failed:', e);
            return false;
          });
          
          if (!pauseSuccess) {
            console.log('Falling back to API call for pause');
            await axios.put(`${API_URL}/api/spotify/player/pause`, null, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
              }
            });
          }
        }
      } catch (error) {
        // Only log errors that aren't about no track being loaded
        if (!error.message?.includes('no list was loaded')) {
          console.error('Error controlling playback:', error);
          setError('Failed to control playback');
        }
      }
    };

    handlePlayback();
  }, [isPlayingProp, player, isReady, deviceId]);

  // Handle volume changes
  useEffect(() => {
    if (!player || !isReady) return;
    
    player.setVolume(volume / 100).catch(error => {
      console.error('Error setting volume:', error);
    });
  }, [volume, player, isReady]);

  // Ready handling
  useEffect(() => {
    if (!player || !isReady || !deviceId) return;

    const transferPlayback = async () => {
      try {
        const token = localStorage.getItem('spotify_access_token');
        await axios.put(`${API_URL}/api/spotify/player`, {
          deviceId
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('Successfully transferred playback to device:', deviceId);
      } catch (error) {
        console.error('Error transferring playback:', error);
      }
    };

    transferPlayback();
  }, [player, isReady, deviceId]);

  // Handle URI changes
  useEffect(() => {
    if (!player || !isReady || !selectedPlaylist || !trackPosition) return;

    const playTrack = async () => {
      console.log('Selected Playlist:', selectedPlaylist);
      console.log('Playing track with context_uri:', `spotify:playlist:${selectedPlaylist}`, 'and offset:', trackPosition);
      try {
        const response = await axios.put(`${API_URL}/api/spotify/player/play`, {
          context_uri: `spotify:playlist:${selectedPlaylist}`,
          offset: { position: trackPosition }
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('API response:', response.data);
      } catch (error) {
        console.error('Error playing track:', error);
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
