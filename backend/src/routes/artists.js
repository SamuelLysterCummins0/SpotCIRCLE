const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware
router.use(authenticateToken);

// Artist routes
router.get('/top', spotifyController.getTopArtists);

module.exports = router;
