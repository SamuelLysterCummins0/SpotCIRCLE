const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get user's top tracks with time range support
router.get('/tracks/top', spotifyController.getTopTracks);

router.get('/playlists/:playlistId/tracks', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { access_token } = req.user;

    // Create Spotify API instance
    const spotifyApi = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: { Authorization: `Bearer ${access_token}` }
    });

    // Get all tracks at once
    const response = await spotifyApi.get(`/playlists/${playlistId}/tracks`, {
      params: {
        fields: 'items(track(id,name,duration_ms,artists,album))'
      }
    });

    // Filter and map valid tracks
    const tracks = response.data.items
      .filter(item => item && item.track)
      .map(item => item.track);

    console.log(`Fetched ${tracks.length} tracks from playlist ${playlistId}`);
    res.json(tracks);

  } catch (error) {
    console.error('Error fetching playlist tracks:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch playlist tracks',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Get user's top artists with time range support
router.get('/artists/top', spotifyController.getTopArtists);

// Get currently playing track
router.get('/player/current', spotifyController.getCurrentTrack);

// Control playback (play, pause, next, previous)
router.post('/player/control', spotifyController.controlPlayback);

module.exports = router;
