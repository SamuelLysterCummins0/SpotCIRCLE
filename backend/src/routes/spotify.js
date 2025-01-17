const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');
const { authenticateToken } = require('../middleware/auth');

router.get('/playlists', authenticateToken, spotifyController.getUserPlaylists);
router.get('/playlists/:playlistId/tracks', authenticateToken, spotifyController.getPlaylistTracks);

module.exports = router;
