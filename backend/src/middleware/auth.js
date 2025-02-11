const { CacheService, CACHE_KEYS } = require('../utils/cache');

exports.authenticateToken = async (req, res, next) => {
  // Get auth header value
  const bearerHeader = req.headers['authorization'];

  if (!bearerHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Format: "Bearer <token>"
    const token = bearerHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Extract user ID from token if possible
    let userId;
    try {
      if (token.includes('.')) {  // Only try to parse if it looks like a JWT
        const base64Url = token.split('.')[1];
        if (base64Url) {
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
          userId = payload.sub || payload.id;
        }
      }
    } catch (e) {
      console.warn('Could not extract user ID from token, using token as is');
      userId = token;  // Fallback to using token as ID
    }
    
    // Add token to request object
    req.user = {
      access_token: token,
      id: userId || token // Fallback to token if userId extraction failed
    };

    // Validate token with Spotify
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Token validation failed: ${response.status}`);
      }

      const userData = await response.json();
      req.user.id = userData.id; // Use actual Spotify user ID
      
    } catch (error) {
      if (userId) {
        // Clear all user-specific caches
        const userCacheKeys = [
          CACHE_KEYS.USER_PLAYLISTS_MINIMAL(userId),
          CACHE_KEYS.USER_PLAYLISTS_DETAILS(userId),
          CACHE_KEYS.USER_PROFILE(userId),
          CACHE_KEYS.USER_PREFERENCES(userId)
        ];
        
        await Promise.all(userCacheKeys.map(key => CacheService.set(key, null, 0)));
      }
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};
