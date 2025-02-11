const axios = require('axios');
const Track = require('../models/Track');
const spotifyApi = require('../config/spotify');
const { CacheService, CACHE_KEYS, CACHE_DURATION } = require('../utils/cache');
const requestQueue = require('../utils/requestQueue');
const SpotifyWebApi = require('spotify-web-api-node');

const getSpotifyApi = (access_token) => {
  return axios.create({
    baseURL: 'https://api.spotify.com/v1',
    headers: { 
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });
};

const handleSpotifyError = (userId, error, res) => {
  CacheService.trackError(userId, error);
  
  // Check for token expiration
  if (error.statusCode === 401 || error.response?.status === 401) {
    // Clear user session
    if (res.clearCookie) {
      res.clearCookie('spotify_access_token');
      res.clearCookie('spotify_refresh_token');
    }
    return res.status(401).json({ 
      error: 'Token expired',
      message: 'Your session has expired. Please log in again.'
    });
  }

  // Handle rate limiting
  if (error.statusCode === 429 || error.response?.status === 429) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.'
    });
  }

  // Handle other errors
  console.error('Spotify API Error:', error);
  const status = error.statusCode || error.response?.status || 500;
  const message = error.message || 'An unexpected error occurred';
  
  return res.status(status).json({ 
    error: 'Spotify API Error',
    message: message
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
  }
};

exports.getTopArtists = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const { time_range = 'short_term' } = req.query;
    
    spotifyApi.setAccessToken(token);
    const data = await spotifyApi.getMyTopArtists({
      limit: 50,
      time_range
    });

    // Transform artist data
    const transformedArtists = data.body.items.map(artist => ({
      id: artist.id,
      name: artist.name,
      uri: artist.uri,
      images: artist.images,
      genres: artist.genres,
      popularity: artist.popularity,
      followers: artist.followers
    }));

    res.json(transformedArtists);
  } catch (error) {
    console.error('Error getting top artists:', error);
    res.status(500).json({ error: 'Failed to get top artists' });
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
    handleSpotifyError(req.user.id, error, res);
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
    handleSpotifyError(req.user.id, error, res);
  }
};

exports.getUserPlaylists = async (req, res) => {
  try {
    const { access_token, id: userId } = req.user;
    req.spotifyApi.setAccessToken(access_token);
    
    try {
      if (!await CacheService.checkRateLimit(userId)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }

      // Use a separate cache key for minimal data
      const minimalCacheKey = CACHE_KEYS.USER_PLAYLISTS_MINIMAL(userId);
      const detailsCacheKey = CACHE_KEYS.USER_PLAYLISTS_DETAILS(userId);
      
      // Check minimal data cache first
      const cachedMinimal = await CacheService.get(minimalCacheKey);
      if (cachedMinimal) {
        // If we have detailed data cached, merge it
        const cachedDetails = await CacheService.get(detailsCacheKey);
        if (cachedDetails) {
          const mergedData = cachedMinimal.map(playlist => ({
            ...playlist,
            ...(cachedDetails.find(d => d.id === playlist.id) || {})
          }));
          return res.json(mergedData);
        }
        return res.json(cachedMinimal);
      }

      // Fetch minimal data for quick display
      const data = await requestQueue.addToQueue(async () => {
        const response = await req.spotifyApi.getUserPlaylists({ 
          limit: 35,
          fields: 'items(id,name,images(url),tracks(total),total),total'  // Only fetch required fields
        });
        return response.body;
      });
      
      const total = Math.min(data.total, 35);
      let allItems = [...data.items].slice(0, 35);
      
      // Format minimal data
      const minimalPlaylists = allItems.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        images: playlist.images,
        tracks: { total: playlist.tracks.total }
      }));

      // Cache minimal data with shorter duration
      await CacheService.set(minimalCacheKey, minimalPlaylists, CACHE_DURATION.PLAYLISTS_MINIMAL);

      res.json(minimalPlaylists);

    } catch (error) {
      return handleSpotifyError(userId, error, res);
    }
  } catch (error) {
    console.error('Error in getUserPlaylists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
};

exports.getPlaylistsDetails = async (req, res) => {
  try {
    const { access_token, id: userId } = req.user;
    req.spotifyApi.setAccessToken(access_token);
    
    try {
      if (!await CacheService.checkRateLimit(userId)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }

      const { playlistIds } = req.query;
      if (!playlistIds) {
        return res.status(400).json({ error: 'No playlist IDs provided' });
      }

      const ids = playlistIds.split(',');
      const detailsCacheKey = CACHE_KEYS.USER_PLAYLISTS_DETAILS(userId);
      
      // Check if we have cached details
      const cachedDetails = await CacheService.get(detailsCacheKey);
      if (cachedDetails) {
        const requestedDetails = cachedDetails.filter(detail => ids.includes(detail.id));
        if (requestedDetails.length === ids.length) {
          return res.json(requestedDetails);
        }
      }

      const detailedPlaylists = [];
      const batchSize = 5;
      
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchPromises = batch.map(async playlistId => {
          try {
            const [playlistDetails, lastTrackInfo] = await Promise.all([
              requestQueue.addToQueue(async () => {
                const response = await req.spotifyApi.getPlaylist(playlistId, {
                  fields: 'collaborative,public,followers(total),tracks(total),snapshot_id,description,owner'
                });
                return response.body;
              }),
              requestQueue.addToQueue(async () => {
                const response = await req.spotifyApi.getPlaylistTracks(playlistId, {
                  offset: 0,
                  limit: 1,
                  fields: 'items(added_at),total',
                  market: 'from_token'
                });
                // If we have tracks, get the last one instead
                if (response.body.total > 0) {
                  return req.spotifyApi.getPlaylistTracks(playlistId, {
                    offset: response.body.total - 1,
                    limit: 1,
                    fields: 'items(added_at)',
                    market: 'from_token'
                  });
                }
                return response;
              })
            ]);

            return {
              id: playlistId,
              description: playlistDetails.description?.replace(/&#x27;/g, "'")?.replace(/&quot;/g, '"') || '',
              owner: playlistDetails.owner,
              collaborative: playlistDetails.collaborative,
              public: playlistDetails.public,
              saves: playlistDetails.followers.total,
              snapshot_id: playlistDetails.snapshot_id,
              last_modified: lastTrackInfo.body.items[0]?.added_at || new Date().toISOString()
            };
          } catch (error) {
            console.warn(`Error fetching details for playlist ${playlistId}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        detailedPlaylists.push(...batchResults.filter(Boolean));
      }

      // Cache the detailed results
      await CacheService.set(detailsCacheKey, detailedPlaylists, CACHE_DURATION.PLAYLISTS_DETAILS);

      res.json(detailedPlaylists);

    } catch (error) {
      return handleSpotifyError(userId, error, res);
    }
  } catch (error) {
    console.error('Error in getPlaylistsDetails:', error);
    res.status(500).json({ error: 'Failed to fetch playlist details' });
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
      const response = await requestQueue.addToQueue(async () => 
        req.spotifyApi.getPlaylistTracks(playlistId, {
          offset: parseInt(offset),
          limit: parseInt(limit),
          fields: 'items(track(id,name,artists(id,name,uri),album(id,name,images,uri),duration_ms,uri,preview_url)),total',
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
      return handleSpotifyError(userId, error, res);
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
    handleSpotifyError(req.user.id, error, res);
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

// Get user's recent tracks
exports.getRecentTracks = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const { time_range = 'short_term' } = req.query;
    
    spotifyApi.setAccessToken(token);
    const data = await spotifyApi.getMyRecentlyPlayedTracks({
      limit: 50
    });

    // Transform track data
    const transformedTracks = data.body.items.map(item => ({
      id: item.track.id,
      name: item.track.name,
      uri: item.track.uri,
      duration_ms: item.track.duration_ms,
      played_at: item.played_at,
      album: {
        id: item.track.album.id,
        name: item.track.album.name,
        images: item.track.album.images
      },
      artists: item.track.artists.map(artist => ({
        id: artist.id,
        name: artist.name,
        uri: artist.uri
      }))
    }));

    res.json(transformedTracks);
  } catch (error) {
    console.error('Error getting recent tracks:', error);
    res.status(500).json({ error: 'Failed to get recent tracks' });
  }
};

// Get user's top tracks
exports.getTopTracks = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const { time_range = 'short_term' } = req.query;
    
    spotifyApi.setAccessToken(token);
    const data = await spotifyApi.getMyTopTracks({
      limit: 50,
      time_range: time_range
    });

    // Transform track data
    const transformedTracks = data.body.items.map(track => ({
      id: track.id,
      name: track.name,
      uri: track.uri,
      duration_ms: track.duration_ms,
      album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images
      },
      artists: track.artists.map(artist => ({
        id: artist.id,
        name: artist.name,
        uri: artist.uri
      }))
    }));

    res.json(transformedTracks);
  } catch (error) {
    console.error('Error getting top tracks:', error);
    res.status(500).json({ error: 'Failed to get top tracks' });
  }
};
