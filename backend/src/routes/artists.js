const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Artist routes
router.get('/top', authController.getTopArtists);

module.exports = router;
