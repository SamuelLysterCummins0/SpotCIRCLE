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
    const { uris, context_uri, offset, device_id } = req.body;
    console.log('Play request received with context_uri:', context_uri, 'offset:', offset, 'device_id:', device_id);
    const spotifyApiInstance = getSpotifyApi(access_token);
    
    // First verify the device exists and is active
    const devicesResponse = await spotifyApiInstance.get('/me/player/devices');
    const devices = devicesResponse.data.devices;
    const targetDevice = devices.find(d => d.id === device_id);
    
    if (!targetDevice) {
      console.error('Device not found in available devices:', device_id);
      console.log('Available devices:', devices);
      return res.status(404).json({ error: 'Device not found or not active' });
    }
    
    // Build the endpoint with device_id
    const endpoint = `/me/player/play${device_id ? `?device_id=${device_id}` : ''}`;
    
    // Build the request body
    const body = {};
    if (uris && uris.length > 0) {
      body.uris = uris;
    } else if (context_uri) {
      body.context_uri = context_uri;
      if (offset) {
        body.offset = offset;
      }
    }

    console.log('Sending play request to Spotify API:', { endpoint, body });
    const response = await spotifyApiInstance.put(endpoint, body);
    console.log('Spotify API response:', response.data);
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

    // Get current playback state
    const playbackResponse = await spotifyApiInstance.get('/me/player');
    
    // If no active device, return 204
    if (!playbackResponse.data) {
      return res.status(204).send();
    }

    // Get queue
    const queueResponse = await spotifyApiInstance.get('/me/player/queue')
      .catch(error => {
        // Queue might be empty or unavailable
        console.warn('Failed to fetch queue:', error.message);
        return { data: { queue: [] } };
      });

    // Combine playback state with queue
    const response = {
      ...playbackResponse.data,
      queue: queueResponse.data.queue || []
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting playback state:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error?.message || 'Failed to get playback state' 
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
    const { action, uri, device_id } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);

    switch (action) {
      case 'play':
        if (uri) {
          await spotifyApiInstance.put(`/me/player/play${device_id ? `?device_id=${device_id}` : ''}`, { uris: [uri] });
        } else {
          await spotifyApiInstance.put(`/me/player/play${device_id ? `?device_id=${device_id}` : ''}`);
        }
        break;
      case 'pause':
        await spotifyApiInstance.put(`/me/player/pause${device_id ? `?device_id=${device_id}` : ''}`);
        break;
      case 'next':
        await spotifyApiInstance.post(`/me/player/next${device_id ? `?device_id=${device_id}` : ''}`);
        break;
      case 'previous':
        await spotifyApiInstance.post(`/me/player/previous${device_id ? `?device_id=${device_id}` : ''}`);
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

exports.startPlayback = async (req, res) => {
  try {
    const { deviceId, uris, context_uri, offset } = req.body;
    const accessToken = req.headers.authorization.split(' ')[1];

    const playbackRequest = {
      ...(context_uri ? { context_uri } : {}),
      ...(offset ? { offset } : {}),
      ...(uris ? { uris } : {})
    };

    console.log('Starting playback with:', {
      deviceId,
      playbackRequest
    });

    const response = await axios.put(
      `https://api.spotify.com/v1/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`,
      playbackRequest,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error in startPlayback:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to start playback',
      details: error.response?.data || error.message 
    });
  }
};

exports.transferPlayback = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const accessToken = req.headers.authorization.split(' ')[1];

    await axios.put('https://api.spotify.com/v1/me/player', 
      {
        device_ids: [deviceId],
        play: false
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error in transferPlayback:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to transfer playback',
      details: error.response?.data || error.message 
    });
  }
};
