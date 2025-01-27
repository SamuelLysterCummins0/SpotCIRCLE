const express = require('express');
const router = express.Router();
const axios = require('axios');
const spotifyController = require('../controllers/spotifyController');
const { authenticateToken } = require('../middleware/auth');

// Debug routes (before auth middleware)
router.get('/debug/cache', spotifyController.debugCache);

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Playlist routes
router.get('/playlists', spotifyController.getUserPlaylists);
router.get('/playlists/:playlistId/tracks', spotifyController.getPlaylistTracks);
router.get('/tracks/top', spotifyController.getTopTracks);

// Player control routes
router.put('/player/play', spotifyController.play);
router.put('/player/pause', spotifyController.pause);
router.post('/player/next', spotifyController.next);
router.post('/player/previous', spotifyController.previous);
router.put('/player/seek', spotifyController.seek);
router.put('/player/volume', spotifyController.setVolume);
router.put('/player/repeat', spotifyController.setRepeatMode);
router.put('/player/shuffle', spotifyController.setShuffle);
router.post('/player/queue', spotifyController.addToQueue);

// Player state routes
router.get('/player/current', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const [playerResponse, queueResponse] = await Promise.all([
      axios.get('https://api.spotify.com/v1/me/player', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }),
      axios.get('https://api.spotify.com/v1/me/player/queue', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
    ]);

    // Spotify returns 204 if no active device
    if (playerResponse.status === 204) {
      return res.json({ device: null });
    }

    // Combine player state with queue data
    const response = {
      ...playerResponse.data,
      queue: queueResponse.data.queue || []
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting player state:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error?.message || 'Failed to get player state'
    });
  }
});

router.get('/player/state', spotifyController.getPlaybackState);
router.get('/player/devices', spotifyController.getDevices);

// Transfer playback to device
router.put('/player', async (req, res) => {
  try {
    // Accept both deviceId and device_id for compatibility
    const deviceId = req.body.deviceId || req.body.device_id;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required (deviceId or device_id)' });
    }

    try {
      // First check if the device is already active
      const currentState = await axios.get('https://api.spotify.com/v1/me/player', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(error => {
        // Handle 204 No Content (no active device)
        if (error.response?.status === 204) {
          return { status: 204, data: null };
        }
        throw error;
      });

      // If current device is the same, no need to transfer
      if (currentState.status !== 204 && currentState.data?.device?.id === deviceId) {
        return res.json({ message: 'Device already active' });
      }

      // Transfer playback to the new device
      await axios.put('https://api.spotify.com/v1/me/player', {
        device_ids: [deviceId],
        play: false // Don't auto-play when transferring
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      res.json({ success: true, deviceId });
    } catch (spotifyError) {
      // Handle specific Spotify API errors
      if (spotifyError.response?.status === 404) {
        return res.status(404).json({ error: 'Device not found' });
      }
      throw spotifyError;
    }
  } catch (error) {
    console.error('Error transferring playback:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || 'Failed to transfer playback';
    res.status(status).json({ 
      error: message,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Start/resume playback
router.put('/play', async (req, res) => {
  try {
    const { deviceId, uris } = req.body;
    const accessToken = req.headers.authorization.split(' ')[1];

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    if (!uris || !Array.isArray(uris) || uris.length === 0) {
      return res.status(400).json({ error: 'Valid track URIs are required' });
    }

    // Filter out any local tracks or invalid URIs
    const validUris = uris.filter(uri => 
      uri && 
      typeof uri === 'string' && 
      !uri.includes('spotify:local') && 
      uri.startsWith('spotify:track:')
    );

    if (validUris.length === 0) {
      return res.status(400).json({ error: 'No valid track URIs provided' });
    }

    // Get current playback state to check active device
    const stateResponse = await axios.get('https://api.spotify.com/v1/me/player', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // If not playing on our device, transfer to it first
    if (!stateResponse.data || stateResponse.data.device.id !== deviceId) {
      console.log('Transferring playback to device:', deviceId);
      await axios.put('https://api.spotify.com/v1/me/player', {
        device_ids: [deviceId],
        play: false
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Wait for transfer to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Starting playback with URIs:', validUris);
    
    // Start playback
    await axios.put(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      { uris: validUris },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error starting playback:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error?.message || error.message || 'Failed to start playback'
    });
  }
});

module.exports = router;
