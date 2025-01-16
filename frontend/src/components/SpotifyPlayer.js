import React, { useState, useEffect } from 'react';

const SpotifyPlayer = ({ uri, isPlaying, onPlayPause }) => {
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'SpotCIRCLE Web Player',
        getOAuthToken: cb => {
          cb(localStorage.getItem('spotify_access_token'));
        },
        volume: 0.5
      });

      player.addListener('initialization_error', ({ message }) => {
        console.error('Failed to initialize:', message);
      });

      player.addListener('authentication_error', ({ message }) => {
        console.error('Failed to authenticate:', message);
        // Refresh token on auth error
        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (refreshToken) {
          fetch('http://localhost:5001/api/auth/refresh', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            params: { refresh_token: refreshToken }
          })
          .then(response => response.json())
          .then(data => {
            localStorage.setItem('spotify_access_token', data.access_token);
            window.location.reload();
          })
          .catch(error => {
            console.error('Error refreshing token:', error);
          });
        }
      });

      player.addListener('account_error', ({ message }) => {
        console.error('Failed to validate Spotify account:', message);
      });

      player.addListener('playback_error', ({ message }) => {
        console.error('Failed to perform playback:', message);
      });

      player.addListener('player_state_changed', state => {
        if (state) {
          onPlayPause && onPlayPause(!state.paused);
        }
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        setDeviceId(device_id);
        setIsReady(true);
        setPlayer(player);
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
        setIsReady(false);
      });

      player.connect();
    };

    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!uri || !isReady || !deviceId) return;

    const play = async () => {
      try {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          body: JSON.stringify({ uris: [uri] }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
          },
        });
      } catch (error) {
        console.error('Error starting playback:', error);
      }
    };

    play();
  }, [uri, isReady, deviceId]);

  useEffect(() => {
    if (!player) return;

    if (isPlaying) {
      player.resume().catch(error => {
        console.error('Error resuming playback:', error);
      });
    } else {
      player.pause().catch(error => {
        console.error('Error pausing playback:', error);
      });
    }
  }, [isPlaying, player]);

  return null;
};

export default SpotifyPlayer;
