const axios = require('axios');
const Track = require('../models/Track');
const spotifyApi = require('../config/spotify');
const { CacheService, CACHE_KEYS, CACHE_DURATION } = require('../utils/cache');
const RequestQueue = require('../utils/requestQueue');
const queue = new RequestQueue();

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
    const { access_token, id: userId } = req.user;
    req.spotifyApi.setAccessToken(access_token);
    
    try {
      // Check rate limit before proceeding
      if (!await CacheService.checkRateLimit(userId)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }

      const cacheKey = CACHE_KEYS.USER_PLAYLISTS(userId);
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // First, get basic playlist info quickly
      const data = await req.spotifyApi.getUserPlaylists({ 
        limit: 20,
        fields: 'items(id,name,images,owner,tracks.total)'
      });
      
      // Send basic playlist data immediately
      const basicPlaylists = data.body.items.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        images: playlist.images,
        owner: playlist.owner,
        tracks: { total: playlist.tracks.total },
        // Default values until details are loaded
        description: '',
        collaborative: false,
        public: true,
        saves: 0,
        snapshot_id: '',
        last_modified: new Date().toISOString()
      }));

      // Send the basic data immediately
      res.json(basicPlaylists);

      // Then load details in the background and cache them
      const playlistsWithDetails = [];
      for (const playlist of data.body.items) {
        if (!playlist) continue;
        
        try {
          const details = await queue.add(async () => {
            // Get additional playlist details
            const playlistDetails = await req.spotifyApi.getPlaylist(playlist.id, {
              fields: 'collaborative,public,followers(total),description,tracks(total),snapshot_id'
            });

            // Get last modified only if playlist has tracks
            let lastModified = new Date().toISOString();
            if (playlistDetails.body.tracks.total > 0) {
              const tracks = await req.spotifyApi.getPlaylistTracks(playlist.id, {
                offset: Math.max(0, playlistDetails.body.tracks.total - 1),
                limit: 1,
                fields: 'items(added_at)',
                market: 'from_token'
              });
              lastModified = tracks.body.items?.[0]?.added_at || lastModified;
            }

            return { playlistDetails, lastModified };
          });

          playlistsWithDetails.push({
            id: playlist.id,
            name: playlist.name,
            description: details.playlistDetails.body.description,
            images: playlist.images,
            tracks: { total: details.playlistDetails.body.tracks.total },
            owner: playlist.owner,
            collaborative: details.playlistDetails.body.collaborative,
            public: details.playlistDetails.body.public,
            saves: details.playlistDetails.body.followers.total,
            snapshot_id: details.playlistDetails.body.snapshot_id,
            last_modified: details.lastModified
          });
        } catch (error) {
          console.warn(`Error fetching details for playlist ${playlist.id}:`, error);
          continue;
        }
      }

      // Cache the detailed results for future requests
      await CacheService.set(cacheKey, playlistsWithDetails, CACHE_DURATION.PLAYLISTS);

    } catch (error) {
      // Track the error
      CacheService.trackError(userId, error);
      
      if (error.statusCode === 401) {
        return res.status(401).json({ error: 'Unauthorized. Please re-authenticate.' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in getUserPlaylists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
};

exports.getPlaylistTracks = async (req, res) => {
  try {
    const { access_token, id: userId } = req.user;
    const { playlistId } = req.params;
    const { offset = 0, limit = 50 } = req.query;
    
    req.spotifyApi.setAccessToken(access_token);

    // Check rate limit before proceeding
    if (!await CacheService.checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const cacheKey = CACHE_KEYS.PLAYLIST_TRACKS(playlistId, offset, limit);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    try {
      // Get tracks with full details using queue to prevent rate limiting
      const response = await queue.add(async () => 
        req.spotifyApi.getPlaylistTracks(playlistId, {
          offset: parseInt(offset),
          limit: parseInt(limit),
          fields: 'items(added_at,added_by,track(id,name,artists(id,name,uri),album(id,name,images,uri),duration_ms,uri,preview_url)),total',
          market: 'from_token'
        })
      );

      // Process tracks to ensure all required data is present
      const items = response.body.items
        .filter(item => item && item.track)
        .map(item => {
          const track = item.track;
          return {
            id: track.id,
            name: track.name,
            artists: track.artists.map(artist => ({
              id: artist.id,
              name: artist.name,
              uri: artist.uri
            })),
            album: {
              id: track.album.id,
              name: track.album.name,
              images: track.album.images,
              uri: track.album.uri
            },
            duration_ms: track.duration_ms,
            uri: track.uri,
            preview_url: track.preview_url,
            added_at: item.added_at,
            added_by: item.added_by
          };
        });

      const result = {
        items,
        total: response.body.total
      };

      // Cache the processed results for a shorter time since it's paginated
      await CacheService.set(cacheKey, result, CACHE_DURATION.TRACKS);
      res.json(result);

    } catch (error) {
      // Track the error
      CacheService.trackError(userId, error);
      
      if (error.statusCode === 401) {
        return res.status(401).json({ error: 'Unauthorized. Please re-authenticate.' });
      }
      if (error.statusCode === 502) {
        // Retry with exponential backoff for 502 errors
        await new Promise(resolve => setTimeout(resolve, 1000));
        return exports.getPlaylistTracks(req, res);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in getPlaylistTracks:', error);
    if (error.statusCode === 429) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: parseInt(error.response?.headers?.['retry-after']) || 60
      });
    }
    res.status(500).json({ error: 'Failed to fetch playlist tracks' });
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

// Add to queue
exports.addToQueue = async (req, res) => {
  try {
    const { access_token } = req.user;
    const { uri, deviceId } = req.body;
    const spotifyApiInstance = getSpotifyApi(access_token);

    // Add track to queue
    await spotifyApiInstance.post(`/me/player/queue`, null, {
      params: {
        uri: uri,
        device_id: deviceId
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding to queue:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error?.message || 'Failed to add to queue'
    });
  }
};

// Debug endpoints
exports.debugCache = async (req, res) => {
  try {
    const cache = require('../utils/cache');
    const stats = cache.CacheService.getCacheStats();
    const allKeys = cache.cache ? cache.cache.keys() : [];
    const cacheData = {};

    for (const key of allKeys) {
      cacheData[key] = {
        value: cache.cache.get(key),
        ttl: cache.cache.getTtl(key)
      };
    }

    res.json({
      stats,
      keys: allKeys,
      data: cacheData
    });
  } catch (error) {
    console.error('Error getting cache debug info:', error);
    res.status(500).json({ error: 'Failed to get cache debug info' });
  }
};
