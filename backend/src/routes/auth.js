const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Auth routes
router.get('/login', authController.getLoginUrl);
router.get('/callback', authController.handleCallback);
router.get('/refresh', authController.refreshToken);
router.get('/recent-tracks', authController.getRecentTracks);
router.get('/top-tracks', authController.getTopTracks);

module.exports = router;
