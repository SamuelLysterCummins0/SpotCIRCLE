const express = require('express');
const router = express.Router();
const querystring = require('querystring');

// Generate a random string for state
const generateRandomString = length => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

router.get('/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = [
    'user-read-private',
    'user-read-email',
    'user-top-read',
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-modify-playback-state',
    'streaming'
  ].join(' ');

  const queryParams = querystring.stringify({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state: state,
    scope: scope,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const spotifyApi = req.spotifyApi;

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;

    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.FRONTEND_URL}/?access_token=${access_token}&refresh_token=${refresh_token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/error`);
  }
});

router.get('/refresh', async (req, res) => {
  const { refresh_token } = req.query;
  const spotifyApi = req.spotifyApi;

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
});

router.get('/artists/:artistId/top-tracks', authController.getArtistTopTracks);
router.get('/albums/:albumId/tracks', authController.getAlbumTracks);

module.exports = router;
