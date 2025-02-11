const NodeCache = require('node-cache');

// Initialize cache with default TTL of 15 minutes and check period of 1 minute
const cache = new NodeCache({
  stdTTL: 900, // 15 minutes in seconds
  checkperiod: 60, // Check for expired keys every minute
  useClones: false // Store/retrieve references to objects instead of copies
});

// Cache keys for authentication and shared resources
const CACHE_KEYS = {
  // Authentication
  ACCESS_TOKEN: (userId) => `auth:${userId}:access_token`,
  REFRESH_TOKEN: (userId) => `auth:${userId}:refresh_token`,
  
  // Rate Limiting
  RATE_LIMIT: (userId) => `rate:${userId}:limit`,
  REQUEST_COUNT: (userId) => `rate:${userId}:count`,
  
  // User Data
  USER_PROFILE: (userId) => `user:${userId}:profile`,
  USER_PREFERENCES: (userId) => `user:${userId}:preferences`,
  USER_PLAYLISTS_MINIMAL: (userId) => `user:${userId}:playlists:minimal`,
  USER_PLAYLISTS_DETAILS: (userId) => `user:${userId}:playlists:details`,
  PLAYLIST_TRACKS: (playlistId, offset, limit) => `playlist:${playlistId}:tracks:${offset}:${limit}`,
  
  // Global Settings
  APP_SETTINGS: () => `app:settings`,
  FEATURE_FLAGS: () => `app:features`,
  
  // Error Tracking
  ERROR_COUNT: (userId) => `error:${userId}:count`,
  LAST_ERROR: (userId) => `error:${userId}:last`
};

// Optimized cache durations in seconds
const CACHE_DURATION = {
  ACCESS_TOKEN: 3300,     // 55 minutes (Spotify tokens last 1 hour)
  REFRESH_TOKEN: 604800,  // 1 week
  RATE_LIMIT: 60,        // 1 minute for rate limiting
  USER_PROFILE: 3600,    // 1 hour
  PLAYLISTS_MINIMAL: 900, // 5 minutes for minimal playlist data
  PLAYLISTS_DETAILS: 900, // 15 minutes for detailed data (changes less frequently)
  TRACKS: 300,           // 5 minutes
  APP_SETTINGS: 300,     // 5 minutes
  ERROR_TRACKING: 86400  // 24 hours
};

// Enhanced cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  rateLimitHits: 0,
  authHits: 0,
  lastAccess: null,
  lastError: null
};

class CacheService {
  static async get(key) {
    try {
      const value = cache.get(key);
      if (value !== undefined) {
        cacheStats.hits++;
        cacheStats.lastAccess = Date.now();
        return value;
      }
      cacheStats.misses++;
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      cacheStats.errors++;
      return null;
    }
  }

  static async set(key, value, ttl = 300) {
    try {
      return cache.set(key, value, ttl);
    } catch (error) {
      console.error('Cache set error:', error);
      cacheStats.errors++;
      return false;
    }
  }

  static async getOrSet(key, fetchFunction, duration = 300) {
    const cached = await this.get(key);
    if (cached) return cached;

    try {
      const value = await fetchFunction();
      await this.set(key, value, duration);
      return value;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      throw error;
    }
  }

  static async checkRateLimit(userId) {
    const key = CACHE_KEYS.RATE_LIMIT(userId);
    const count = (await this.get(key)) || 0;
    
    if (count >= 100) { // Spotify's rate limit
      cacheStats.rateLimitHits++;
      return false;
    }

    await this.set(key, count + 1, CACHE_DURATION.RATE_LIMIT);
    return true;
  }

  static async trackError(userId, error) {
    const countKey = CACHE_KEYS.ERROR_COUNT(userId);
    const lastKey = CACHE_KEYS.LAST_ERROR(userId);
    
    const count = (await this.get(countKey)) || 0;
    await this.set(countKey, count + 1, CACHE_DURATION.ERROR_TRACKING);
    await this.set(lastKey, {
      timestamp: Date.now(),
      error: error.message || error.toString()
    }, CACHE_DURATION.ERROR_TRACKING);
    
    cacheStats.errors++;
  }

  static getCacheStats() {
    return {
      ...cacheStats,
      keys: cache.keys(),
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
}

module.exports = {
  CacheService,
  CACHE_KEYS,
  CACHE_DURATION
};
