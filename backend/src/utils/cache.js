const NodeCache = require('node-cache');

// Initialize cache with default TTL of 30 minutes and check period of 1 minute
const cache = new NodeCache({
  stdTTL: 1800, // 30 minutes in seconds
  checkperiod: 60, // Check for expired keys every minute
  useClones: false // Store/retrieve references to objects instead of copies
});

// Cache keys with snapshot support
const CACHE_KEYS = {
  USER_PLAYLISTS: (userId) => `user:${userId}:playlists`,
  PLAYLIST_TRACKS: (playlistId, offset, limit, snapshotId = '') => 
    `playlist:${playlistId}:tracks:${offset}:${limit}${snapshotId ? `:${snapshotId}` : ''}`,
  PLAYLIST_INFO: (playlistId) => `playlist:${playlistId}:info`,
  TOP_TRACKS: (userId, timeRange) => `user:${userId}:top-tracks:${timeRange}`,
  TOP_ARTISTS: (userId, timeRange) => `user:${userId}:top-artists:${timeRange}`,
  TRACK_METADATA: (trackId) => `track:${trackId}:metadata`,
  USER_PROFILE: (userId) => `user:${userId}:profile`
};

// Optimized cache durations in seconds
const CACHE_DURATION = {
  PLAYLISTS: 900,        // 15 minutes for playlist metadata
  PLAYLIST_TRACKS: 1800, // 30 minutes for playlist tracks
  TRACK_METADATA: 3600, // 1 hour for track details
  TOP_ITEMS: 7200,     // 2 hours for top tracks/artists
  USER_PROFILE: 3600   // 1 hour for user data
};

// Cache statistics
let cacheStats = {
  hits: 0,
  misses: 0
};

class CacheService {
  static async getOrSet(key, fetchFunction, duration = CACHE_DURATION.PLAYLISTS) {
    const cachedData = cache.get(key);
    if (cachedData !== undefined) {
      cacheStats.hits++;
      console.log(` Cache HIT for ${key} (Total hits: ${cacheStats.hits})`);
      return cachedData;
    }

    cacheStats.misses++;
    console.log(` Cache MISS for ${key} (Total misses: ${cacheStats.misses})`);
    
    try {
      const freshData = await fetchFunction();
      if (freshData !== undefined && freshData !== null) {
        cache.set(key, freshData, duration);
        console.log(` Cached data for ${key} (TTL: ${duration}s)`);
      }
      return freshData;
    } catch (error) {
      console.error(` Error fetching data for cache key ${key}:`, error);
      throw error;
    }
  }

  static invalidate(key) {
    console.log(` Invalidating cache for key: ${key}`);
    return cache.del(key);
  }

  static invalidateUserData(userId) {
    console.log(` Invalidating all cache data for user: ${userId}`);
    const userKeys = cache.keys().filter(key => key.includes(`user:${userId}`));
    userKeys.forEach(key => cache.del(key));
    console.log(`Invalidated ${userKeys.length} keys for user ${userId}`);
  }

  static async getPlaylistTracks(playlistId, offset, limit, snapshotId, fetchFunction) {
    const key = CACHE_KEYS.PLAYLIST_TRACKS(playlistId, offset, limit, snapshotId);
    return this.getOrSet(key, fetchFunction, CACHE_DURATION.PLAYLIST_TRACKS);
  }

  static async getUserPlaylists(userId, fetchFunction) {
    const key = CACHE_KEYS.USER_PLAYLISTS(userId);
    return this.getOrSet(key, fetchFunction, CACHE_DURATION.PLAYLISTS);
  }

  static async getTopItems(userId, type, timeRange, fetchFunction) {
    const key = type === 'tracks' 
      ? CACHE_KEYS.TOP_TRACKS(userId, timeRange)
      : CACHE_KEYS.TOP_ARTISTS(userId, timeRange);
    return this.getOrSet(key, fetchFunction, CACHE_DURATION.TOP_ITEMS);
  }

  static async getTrackMetadata(trackId, fetchFunction) {
    const key = CACHE_KEYS.TRACK_METADATA(trackId);
    return this.getOrSet(key, fetchFunction, CACHE_DURATION.TRACK_METADATA);
  }

  static getCacheStats() {
    return {
      ...cacheStats,
      keys: cache.keys().length,
      hitRatio: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0
    };
  }
}

module.exports = {
  CacheService,
  CACHE_KEYS,
  CACHE_DURATION,
  cache // Export cache instance for debugging
};
