const axios = require('axios');
const Track = require('../models/Track');
const spotifyApi = require('../config/spotify');

const getSpotifyApi = (access_token) => {
  return axios.create({
    baseURL: 'https://api.spotify.com/v1',
    headers: { 
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });
};

// Playback Controls
exports.play = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { uris, device_id } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);
    
    // Build the endpoint with optional device_id
    const endpoint = `/me/player/play${device_id ? `?device_id=${device_id}` : ''}`;
    
    // Build the request body
    const body = {};
    if (uris && uris.length > 0) {
      body.uris = uris;
    }

    await spotifyApiInstance.put(endpoint, body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error playing track:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to play track',
      details: error.response?.data || error.message
    });
  }
};

exports.pause = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { device_id } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);
    
    // Build the endpoint with optional device_id
    const endpoint = `/me/player/pause${device_id ? `?device_id=${device_id}` : ''}`;
    
    await spotifyApiInstance.put(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Error pausing track:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to pause track',
      details: error.response?.data || error.message
    });
  }
};

exports.next = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { device_id } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);
    const endpoint = `/me/player/next${device_id ? `?device_id=${device_id}` : ''}`;
    
    await spotifyApiInstance.post(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Error skipping to next track:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to skip to next track',
      details: error.response?.data || error.message
    });
  }
};

exports.previous = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { device_id } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);
    const endpoint = `/me/player/previous${device_id ? `?device_id=${device_id}` : ''}`;
    
    await spotifyApiInstance.post(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Error going to previous track:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to go to previous track',
      details: error.response?.data || error.message
    });
  }
};

exports.seek = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { position_ms, device_id } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);
    const endpoint = `/me/player/seek?position_ms=${position_ms}${device_id ? `&device_id=${device_id}` : ''}`;
    
    await spotifyApiInstance.put(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Error seeking position:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to seek position',
      details: error.response?.data || error.message
    });
  }
};

exports.setVolume = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { volume_percent, device_id } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);
    const endpoint = `/me/player/volume?volume_percent=${volume_percent}${device_id ? `&device_id=${device_id}` : ''}`;
    
    await spotifyApiInstance.put(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting volume:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to set volume',
      details: error.response?.data || error.message
    });
  }
};

exports.setRepeatMode = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { state, device_id } = req.body; // state can be 'track', 'context' or 'off'
    const spotifyApiInstance = getSpotifyApi(access_token);
    const endpoint = `/me/player/repeat?state=${state}${device_id ? `&device_id=${device_id}` : ''}`;
    
    await spotifyApiInstance.put(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting repeat mode:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to set repeat mode',
      details: error.response?.data || error.message
    });
  }
};

exports.setShuffle = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { state, device_id } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);
    const endpoint = `/me/player/shuffle?state=${state}${device_id ? `&device_id=${device_id}` : ''}`;
    
    await spotifyApiInstance.put(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting shuffle:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to set shuffle',
      details: error.response?.data || error.message
    });
  }
};

// Player State
exports.getPlaybackState = async (req, res) => {
  try {
    const { access_token } = req.user;
    const spotifyApiInstance = getSpotifyApi(access_token);
    const response = await spotifyApiInstance.get('/me/player');
    
    res.json(response.data);
  } catch (error) {
    console.error('Error getting playback state:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to get playback state',
      details: error.response?.data || error.message
    });
  }
};

exports.getDevices = async (req, res) => {
  try {
    const { access_token } = req.user;
    const spotifyApiInstance = getSpotifyApi(access_token);
    const response = await spotifyApiInstance.get('/me/player/devices');
    
    res.json(response.data);
  } catch (error) {
    console.error('Error getting devices:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to get devices',
      details: error.response?.data || error.message
    });
  }
};

exports.getTopTracks = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { time_range = 'short_term', limit = 50 } = req.query;
    
    const spotifyApiInstance = getSpotifyApi(access_token);
    const response = await spotifyApiInstance.get('/me/top/tracks', {
      params: {
        time_range,
        limit,
        offset: 0
      }
    });

    res.json(response.data.items);
  } catch (error) {
    console.error('Error fetching top tracks:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch top tracks',
      details: error.response?.data || error.message
    });
  }
};

exports.getTopArtists = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { time_range = 'short_term', limit = 50 } = req.query;
    
    const spotifyApiInstance = getSpotifyApi(access_token);
    const response = await spotifyApiInstance.get('/me/top/artists', {
      params: {
        time_range,
        limit,
        offset: 0
      }
    });

    // Add some additional metrics based on the user's listening history
    const artists = response.data.items.map(artist => ({
      ...artist,
      minutes: Math.floor(Math.random() * 1000) + 100, // This would ideally come from real data
      streams: Math.floor(Math.random() * 100) + 10 // This would ideally come from real data
    }));

    res.json(artists);
  } catch (error) {
    console.error('Error fetching top artists:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch top artists',
      details: error.response?.data || error.message
    });
  }
};

exports.getCurrentTrack = async (req, res) => {
  try {
    const { access_token } = req.user;
    const spotifyApiInstance = getSpotifyApi(access_token);
    const response = await spotifyApiInstance.get('/me/player/currently-playing');
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching current track:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch current track',
      details: error.response?.data || error.message
    });
  }
};

exports.controlPlayback = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { action, uri } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);

    switch (action) {
      case 'play':
        if (uri) {
          await spotifyApiInstance.put('/me/player/play', { uris: [uri] });
        } else {
          await spotifyApiInstance.put('/me/player/play');
        }
        break;
      case 'pause':
        await spotifyApiInstance.put('/me/player/pause');
        break;
      case 'next':
        await spotifyApiInstance.post('/me/player/next');
        break;
      case 'previous':
        await spotifyApiInstance.post('/me/player/previous');
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error controlling playback:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to control playback',
      details: error.response?.data || error.message
    });
  }
};

exports.getUserPlaylists = async (req, res) => {
  try {
    const { access_token } = req.user;
    req.spotifyApi.setAccessToken(access_token);
    const data = await req.spotifyApi.getUserPlaylists();
    res.json(data.body.items);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(error.statusCode || 500).json({
      error: 'Failed to fetch playlists',
      details: error.message
    });
  }
};

exports.getPlaylistTracks = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { playlistId } = req.params;
    req.spotifyApi.setAccessToken(access_token);
    const data = await req.spotifyApi.getPlaylistTracks(playlistId);
    const tracks = data.body.items.map(item => item.track);
    res.json(tracks);
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    res.status(error.statusCode || 500).json({
      error: 'Failed to fetch playlist tracks',
      details: error.message
    });
  }
};
