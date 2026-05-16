// Auth middleware: trusts the Spotify access token in the Authorization header
// and uses the X-User-Id header (set by the frontend from localStorage) to
// scope cache keys. Spotify itself enforces token validity on the actual
// downstream call; controllers handle 401s via handleSpotifyError, so we
// don't need a separate /v1/me round-trip on every request.

exports.authenticateToken = (req, res, next) => {
  const bearerHeader = req.headers['authorization'];

  if (!bearerHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = bearerHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const userId = req.headers['x-user-id'] || null;

  req.user = {
    access_token: token,
    id: userId,
  };

  next();
};
