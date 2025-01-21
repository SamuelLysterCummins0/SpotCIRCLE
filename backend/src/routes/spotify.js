const express = require('express');
const router = express.Router();
const axios = require('axios');
const spotifyController = require('../controllers/spotifyController');
const { authenticateToken } = require('../middleware/auth');

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

// Player state routes
router.get('/player/current', spotifyController.getCurrentTrack);
router.get('/player/state', spotifyController.getPlaybackState);
router.get('/player/devices', spotifyController.getDevices);

// Transfer playback to device
router.put('/player', async (req, res) => {
  try {
    const { deviceId } = req.body;
    const accessToken = req.headers.authorization.split(' ')[1];
    
    // Transfer playback to the specified device
    await axios.put('https://api.spotify.com/v1/me/player', {
      device_ids: [deviceId],
      play: false
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Wait for the transfer to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    res.json({ success: true });
  } catch (error) {
    console.error('Error transferring playback:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to transfer playback' });
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
