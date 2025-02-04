const SpotifyWebApi = require('spotify-web-api-node');
const Track = require('../models/Track');
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const spotifyApi = require('../config/spotify');

// Cache to prevent code reuse
const usedCodes = new Set();

// Generate login URL
const getLoginUrl = (req, res) => {
  const scopes = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-top-read',
    'user-read-recently-played',
    'user-read-playback-state',
    'user-modify-playback-state',
    'streaming',
    'app-remote-control'
  ];
  
  const state = Math.random().toString(36).substring(7);
  
  // Manually construct the authorization URL
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state: state,
    scope: scopes.join(' ')
  });

  const authorizeURL = `https://accounts.spotify.com/authorize?${params.toString()}`;
  console.log('Generated authorize URL:', authorizeURL);
  res.json({ url: authorizeURL });
};

// Handle callback from Spotify
const handleCallback = async (req, res) => {
  const { code } = req.query;
  
  try {
    // Check if code has been used
    if (usedCodes.has(code)) {
      console.log('Auth code has already been used:', code);
      return res.redirect(`${process.env.FRONTEND_URL}?error=code_used`);
    }

    console.log('Received auth code:', code);
    
    // Add code to used codes set
    usedCodes.add(code);
    
    // Clean up old codes (optional)
    if (usedCodes.size > 1000) {
      usedCodes.clear();
    }

    const data = await spotifyApi.authorizationCodeGrant(code);
    console.log('Auth code grant response:', data.body);
    
    const { access_token, refresh_token } = data.body;

    // Set the access token
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    // Get user info
    const userResponse = await spotifyApi.getMe();
    const userId = userResponse.body.id;

    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.FRONTEND_URL}?access_token=${access_token}&refresh_token=${refresh_token}&user_id=${userId}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  const { refresh_token } = req.query;

  try {
    spotifyApi.setRefreshToken(refresh_token);
    const data = await spotifyApi.refreshAccessToken();
    const { access_token } = data.body;

    res.json({
      access_token,
      refresh_token
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

// Get user's top tracks
const getTopTracks = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const { time_range = 'short_term' } = req.query;
    
    spotifyApi.setAccessToken(token);
    const data = await spotifyApi.getMyTopTracks({
      limit: 50,
      time_range: time_range
    });

    // Transform track data to include necessary fields
    const transformedTracks = data.body.items.map(track => ({
      id: track.id,
      name: track.name,
      uri: track.uri,
      duration_ms: track.duration_ms,
      album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images,
        release_date: track.album.release_date
      },
      artists: track.artists.map(artist => ({
        id: artist.id,
        name: artist.name,
        uri: artist.uri
      }))
    }));

    res.json(transformedTracks);
  } catch (error) {
    console.error('Error fetching top tracks:', error);
    res.status(500).json({ error: 'Failed to fetch top tracks' });
  }
};

// Get user's top artists
const getTopArtists = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const { time_range = 'short_term' } = req.query;
    
    spotifyApi.setAccessToken(token);
    const data = await spotifyApi.getMyTopArtists({
      limit: 50,
      time_range
    });

    res.json(data.body.items);
  } catch (error) {
    console.error('Error fetching top artists:', error);
    res.status(500).json({ error: 'Failed to fetch top artists' });
  }
};

// Get user's recent tracks
const getRecentTracks = async (req, res) => {
  try {
    const { access_token } = req.headers.authorization.split(' ')[1];
    
    spotifyApi.setAccessToken(access_token);
    const data = await spotifyApi.getMyRecentlyPlayedTracks({
      limit: 50
    });

    res.json(data.body.items);
  } catch (error) {
    console.error('Error fetching recent tracks:', error);
    res.status(500).json({ error: 'Failed to fetch recent tracks' });
  }
};

module.exports = {
  getLoginUrl,
  handleCallback,
  refreshToken,
  getTopTracks,
  getTopArtists,
  getRecentTracks
};
