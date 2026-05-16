// Simple per-prefix cache backed by localStorage (or sessionStorage for the
// player). Stores { data, timestamp } JSON blobs and treats anything older
// than `duration` ms as a miss. Quota errors trigger a one-pass cleanup of
// expired entries before retrying.

export const CACHE_DURATION = {
  PLAYLIST: 15 * 60 * 1000,
  PLAYLIST_DETAILS: 15 * 60 * 1000,
  UI_STATE: 24 * 60 * 60 * 1000,
  PLAYER: 30 * 60 * 1000,
  SEARCH: 7 * 24 * 60 * 60 * 1000,
  STATS: 10 * 60 * 1000,
  HEADER: 10 * 60 * 1000,
  TIME_RANGE: 30 * 60 * 1000,
};

export const CACHE_KEYS = {
  TRACKS: (playlistId) => `tracks:${playlistId}`,
  STATS: (playlistId) => `playlist:${playlistId}:stats`,
  HEADER_STATS: (playlistId) => `playlist:${playlistId}:header_stats`,
  TIME_RANGE_DATA: (timeRange) => `time_range:${timeRange}:data`,
  USER_PLAYLISTS: 'playlists:user',
  PLAYLIST_MINIMAL: 'playlists:minimal',
  PLAYLIST_DETAILS: 'playlists:details',
  RECENT_TRACKS: 'tracks:recent',
};

class CacheManager {
  constructor(prefix, storage = localStorage) {
    this.prefix = prefix;
    this.storage = storage;
  }

  _key(key) {
    return `${this.prefix}_${key}`;
  }

  get(key, duration) {
    const fullKey = this._key(key);
    try {
      const stored = this.storage.getItem(fullKey);
      if (!stored) return null;

      const item = JSON.parse(stored);
      if (Date.now() - item.timestamp > duration) {
        this.storage.removeItem(fullKey);
        return null;
      }
      return item.data;
    } catch {
      return null;
    }
  }

  set(key, data, duration) {
    const fullKey = this._key(key);
    const payload = JSON.stringify({ data, timestamp: Date.now() });

    try {
      this.storage.setItem(fullKey, payload);
    } catch (error) {
      if (error.name !== 'QuotaExceededError') return;
      this._purgeExpired(duration);
      try {
        this.storage.setItem(fullKey, payload);
      } catch {
        // Give up silently — a cache miss next time is fine.
      }
    }
  }

  remove(key) {
    this.storage.removeItem(this._key(key));
  }

  clear() {
    Object.keys(this.storage).forEach((key) => {
      if (key.startsWith(this.prefix)) {
        this.storage.removeItem(key);
      }
    });
  }

  _purgeExpired(duration) {
    Object.keys(this.storage).forEach((key) => {
      if (!key.startsWith(this.prefix)) return;
      try {
        const item = JSON.parse(this.storage.getItem(key));
        if (Date.now() - item.timestamp > duration) {
          this.storage.removeItem(key);
        }
      } catch {
        this.storage.removeItem(key);
      }
    });
  }
}

export const playlistCache = new CacheManager('playlist');
export const uiStateCache = new CacheManager('ui');
export const playerCache = new CacheManager('player', sessionStorage);
