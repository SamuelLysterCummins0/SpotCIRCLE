const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get user's top tracks with time range support
router.get('/tracks/top', spotifyController.getTopTracks);

// Get user's top artists with time range support
router.get('/artists/top', spotifyController.getTopArtists);

// Get currently playing track
router.get('/player/current', spotifyController.getCurrentTrack);

// Control playback (play, pause, next, previous)
router.post('/player/control', spotifyController.controlPlayback);

module.exports = router;
