const SpotifyWebApi = require('spotify-web-api-node');
const Track = require('../models/Track');
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const spotifyApi = require('../config/spotify');
const { CacheService, CACHE_KEYS } = require('../utils/cache');

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
    'app-remote-control',
    'playlist-read-private',
    'playlist-read-collaborative'
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
    
    const { access_token, refresh_token, expires_in } = data.body;

    // Set the access token
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    // Get user info
    const userResponse = await spotifyApi.getMe();
    const userId = userResponse.body.id;

    // Calculate expiration timestamp
    const expiresAt = Date.now() + (expires_in * 1000);

    // Redirect to frontend with tokens and expiration
    const redirectUrl = `${process.env.FRONTEND_URL}?` + new URLSearchParams({
      access_token,
      refresh_token,
      expires_in,
      expires_at: expiresAt,
      user_id: userId
    }).toString();

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    // Clear code from used codes if exchange failed
    usedCodes.delete(code);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  const { refresh_token } = req.query;

  try {
    spotifyApi.setRefreshToken(refresh_token);
    const data = await spotifyApi.refreshAccessToken();
    const { access_token, expires_in } = data.body;

    // Calculate expiration timestamp
    const expiresAt = Date.now() + (expires_in * 1000);

    // Clear all user-specific caches on token refresh
    try {
      const base64Url = access_token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
      const userId = payload.sub || payload.id;
      
      if (userId) {
        const userCacheKeys = [
          CACHE_KEYS.USER_PLAYLISTS_MINIMAL(userId),
          CACHE_KEYS.USER_PLAYLISTS_DETAILS(userId),
          CACHE_KEYS.USER_PROFILE(userId),
          CACHE_KEYS.USER_PREFERENCES(userId)
        ];
        
        await Promise.all(userCacheKeys.map(key => CacheService.set(key, null, 0)));
      }
    } catch (e) {
      console.warn('Could not clear user caches during token refresh:', e);
    }

    res.json({
      access_token,
      refresh_token,
      expires_in,
      expires_at: expiresAt
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

module.exports = {
  getLoginUrl,
  handleCallback,
  refreshToken
};
