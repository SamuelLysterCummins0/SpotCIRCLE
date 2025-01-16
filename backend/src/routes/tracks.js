const express = require('express');
const router = express.Router();
const spotifyApi = require('../config/spotify');

// Middleware to set access token
const setAccessToken = (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    spotifyApi.setAccessToken(token);
    next();
};

// Transform track data
const transformTrack = (track) => ({
    id: track.id,
    name: track.name,
    uri: track.uri,
    artists: track.artists.map(artist => ({
        id: artist.id,
        name: artist.name
    })),
    album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images
    },
    duration_ms: track.duration_ms,
    preview_url: track.preview_url
});

// Get user's saved tracks
router.get('/', setAccessToken, async (req, res) => {
    try {
        const data = await spotifyApi.getMySavedTracks({
            limit: 50,
            offset: 0
        });

        const tracks = data.body.items.map(item => transformTrack(item.track));
        res.json(tracks);
    } catch (error) {
        console.error('Error fetching tracks:', error);
        if (error.statusCode === 401) {
            res.status(401).json({ error: 'Token expired' });
        } else {
            res.status(500).json({ error: 'Failed to fetch tracks' });
        }
    }
});

// Get user's top tracks
router.get('/top', setAccessToken, async (req, res) => {
    try {
        const data = await spotifyApi.getMyTopTracks({
            limit: 50,
            time_range: 'short_term' // Can be long_term, medium_term, short_term
        });

        const tracks = data.body.items.map(track => transformTrack(track));
        res.json(tracks);
    } catch (error) {
        console.error('Error fetching top tracks:', error);
        if (error.statusCode === 401) {
            res.status(401).json({ error: 'Token expired' });
        } else {
            res.status(500).json({ error: 'Failed to fetch top tracks' });
        }
    }
});

// Get user's recently played tracks
router.get('/recent', setAccessToken, async (req, res) => {
    try {
        const data = await spotifyApi.getMyRecentlyPlayedTracks({
            limit: 50
        });

        const tracks = data.body.items.map(item => transformTrack(item.track));
        res.json(tracks);
    } catch (error) {
        console.error('Error fetching recent tracks:', error);
        if (error.statusCode === 401) {
            res.status(401).json({ error: 'Token expired' });
        } else {
            res.status(500).json({ error: 'Failed to fetch recent tracks' });
        }
    }
});

module.exports = router;
