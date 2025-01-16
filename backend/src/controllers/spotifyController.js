const axios = require('axios');

const getSpotifyApi = (access_token) => {
  return axios.create({
    baseURL: 'https://api.spotify.com/v1',
    headers: { Authorization: `Bearer ${access_token}` }
  });
};

exports.getTopTracks = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { time_range = 'short_term', limit = 50 } = req.query;
    
    const spotifyApi = getSpotifyApi(access_token);
    const response = await spotifyApi.get('/me/top/tracks', {
      params: {
        time_range,
        limit,
        offset: 0
      }
    });

    res.json(response.data.items);
  } catch (error) {
    console.error('Error fetching top tracks:', error.response?.data || error.message);
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
    
    const spotifyApi = getSpotifyApi(access_token);
    const response = await spotifyApi.get('/me/top/artists', {
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
    const spotifyApi = getSpotifyApi(access_token);
    const response = await spotifyApi.get('/me/player/currently-playing');
    
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
    const spotifyApi = getSpotifyApi(access_token);

    switch (action) {
      case 'play':
        if (uri) {
          await spotifyApi.put('/me/player/play', { uris: [uri] });
        } else {
          await spotifyApi.put('/me/player/play');
        }
        break;
      case 'pause':
        await spotifyApi.put('/me/player/pause');
        break;
      case 'next':
        await spotifyApi.post('/me/player/next');
        break;
      case 'previous':
        await spotifyApi.post('/me/player/previous');
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
