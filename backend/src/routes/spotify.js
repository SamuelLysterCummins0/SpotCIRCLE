const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Playback Controls
router.put('/player/play', spotifyController.play);
router.put('/player/pause', spotifyController.pause);
router.post('/player/next', spotifyController.next);
router.post('/player/previous', spotifyController.previous);
router.put('/player/seek', spotifyController.seek);
router.put('/player/volume', spotifyController.setVolume);
router.put('/player/repeat', spotifyController.setRepeatMode);
router.put('/player/shuffle', spotifyController.setShuffle);

// Player State
router.get('/player/current', spotifyController.getCurrentTrack);
router.get('/player/state', spotifyController.getPlaybackState);
router.get('/player/devices', spotifyController.getDevices);

// User Data
router.get('/tracks/top', spotifyController.getTopTracks);
router.get('/artists/top', spotifyController.getTopArtists);
router.get('/playlists', spotifyController.getUserPlaylists);
router.get('/playlists/:playlistId/tracks', spotifyController.getPlaylistTracks);

module.exports = router;
