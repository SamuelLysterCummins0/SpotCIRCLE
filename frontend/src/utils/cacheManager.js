// Cache durations in milliseconds
export const CACHE_DURATION = {
  PLAYLIST: 15 * 60 * 1000,    // 15 minutes (matching backend)
  PLAYLIST_DETAILS: 15 * 60 * 1000, // 15 minutes (matching backend)
  UI_STATE: 24 * 60 * 60 * 1000, // 24 hours
  PLAYER: 30 * 60 * 1000,      // 30 minutes
  SEARCH: 7 * 24 * 60 * 60 * 1000, // 7 days
  STATS: 10 * 60 * 1000,    // 10 minutes
  HEADER: 10 * 60 * 1000,    // 10 minutes
  TIME_RANGE: 30 * 60 * 1000 // 30 minutes
};

// Cache keys
export const CACHE_KEYS = {
  TRACKS: (playlistId) => `tracks:${playlistId}`,
  STATS: (playlistId) => `playlist:${playlistId}:stats`,
  HEADER_STATS: (playlistId) => `playlist:${playlistId}:header_stats`,
  TIME_RANGE_DATA: (timeRange) => `time_range:${timeRange}:data`,
  PLAYLIST_MINIMAL: 'playlists:minimal',
  PLAYLIST_DETAILS: 'playlists:details'
};

class CacheManager {
  constructor(prefix, storage = localStorage) {
    this.prefix = prefix;
    this.storage = storage;
    this.memoryCache = new Map();
    this.maxMemoryItems = 10;
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      storageHits: 0,
      writes: 0,
      errors: 0,
      lastAccessed: null,
      lastWrite: null
    };
  }

  _getFullKey(key) {
    return `${this.prefix}_${key}`;
  }

  _isExpired(timestamp, duration) {
    return Date.now() - timestamp > duration;
  }

  set(key, data, duration) {
    const fullKey = this._getFullKey(key);
    const item = {
      data,
      timestamp: Date.now()
    };

    try {
      // Save to memory cache
      this.memoryCache.set(fullKey, item);
      this.stats.writes++;
      this.stats.lastWrite = new Date().toISOString();

      // Limit memory cache size
      if (this.memoryCache.size > this.maxMemoryItems) {
        const oldestKey = [...this.memoryCache.keys()][0];
        this.memoryCache.delete(oldestKey);
      }

      // Save to storage
      this.storage.setItem(fullKey, JSON.stringify(item));
    } catch (error) {
      this.stats.errors++;
      if (error.name === 'QuotaExceededError') {
        this._clearOldItems(duration);
        try {
          this.storage.setItem(fullKey, JSON.stringify(item));
        } catch (e) {
          this.stats.errors++;
          console.warn('Could not save to storage even after cleanup');
        }
      }
    }
  }

  get(key, duration) {
    const fullKey = this._getFullKey(key);
    this.stats.lastAccessed = new Date().toISOString();

    // Check memory cache first
    const memoryItem = this.memoryCache.get(fullKey);
    if (memoryItem && !this._isExpired(memoryItem.timestamp, duration)) {
      this.stats.hits++;
      this.stats.memoryHits++;
      return memoryItem.data;
    }

    // Check storage
    try {
      const stored = this.storage.getItem(fullKey);
      if (stored) {
        const item = JSON.parse(stored);
        if (!this._isExpired(item.timestamp, duration)) {
          // Update memory cache
          this.memoryCache.set(fullKey, item);
          this.stats.hits++;
          this.stats.storageHits++;
          return item.data;
        }
        // Remove expired item
        this.storage.removeItem(fullKey);
      }
    } catch (error) {
      this.stats.errors++;
      console.warn('Error reading from storage:', error);
    }

    this.stats.misses++;
    return null;
  }

  _clearOldItems(duration) {
    const keys = Object.keys(this.storage);
    const ourKeys = keys.filter(key => key.startsWith(this.prefix));
    
    ourKeys.forEach(key => {
      try {
        const item = JSON.parse(this.storage.getItem(key));
        if (this._isExpired(item.timestamp, duration)) {
          this.storage.removeItem(key);
        }
      } catch (e) {
        // Remove invalid items
        this.storage.removeItem(key);
      }
    });
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: totalRequests ? (this.stats.hits / totalRequests * 100).toFixed(2) + '%' : '0%',
      memoryHitRate: this.stats.hits ? (this.stats.memoryHits / this.stats.hits * 100).toFixed(2) + '%' : '0%',
      itemCount: this.memoryCache.size,
      storageItemCount: Object.keys(this.storage).filter(key => key.startsWith(this.prefix)).length
    };
  }

  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      storageHits: 0,
      writes: 0,
      errors: 0,
      lastAccessed: null,
      lastWrite: null
    };
  }

  remove(key) {
    const fullKey = this._getFullKey(key);
    this.memoryCache.delete(fullKey);
    this.storage.removeItem(fullKey);
  }

  clear() {
    this.memoryCache.clear();
    const keys = Object.keys(this.storage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        this.storage.removeItem(key);
      }
    });
  }

  clearOnTokenRefresh() {
    this.memoryCache.clear();
    Object.keys(this.storage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        this.storage.removeItem(key);
      }
    });
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      storageHits: 0,
      writes: 0,
      errors: 0,
      lastAccessed: null,
      lastWrite: null
    };
  }
}

// Create instances for different types of data
export const playlistCache = new CacheManager('playlist');
export const uiStateCache = new CacheManager('ui');
export const playerCache = new CacheManager('player', sessionStorage);
export const searchCache = new CacheManager('search');

// Export a function to get stats from all caches
export const getCacheStats = () => ({
  playlist: playlistCache.getStats(),
  ui: uiStateCache.getStats(),
  player: playerCache.getStats(),
  search: searchCache.getStats()
});
