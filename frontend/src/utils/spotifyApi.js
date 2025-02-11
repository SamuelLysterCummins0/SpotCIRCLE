import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// Configure base axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth token and expiration check
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('spotify_access_token');
    const expiresAt = localStorage.getItem('spotify_token_expires_at');

    // Check if token exists and is not expired
    if (!token || !expiresAt) {
      // No valid token, redirect to login
      localStorage.clear();
      sessionStorage.clear();
      if (window.playlistCache) {
        window.playlistCache.flushAll();
      }
      window.location.href = '/';
      return Promise.reject(new Error('No valid token'));
    }

    // Check if token is expired
    const now = Date.now();
    const expiration = parseInt(expiresAt);

    if (expiration <= now) {
      console.log('Token expired, attempting refresh');
      // Try to refresh the token
      const refreshToken = localStorage.getItem('spotify_refresh_token');
      if (refreshToken) {
        return axios.get(`${API_URL}/auth/refresh`, {
          params: { refresh_token: refreshToken }
        }).then(response => {
          const { access_token, expires_at } = response.data;
          localStorage.setItem('spotify_access_token', access_token);
          localStorage.setItem('spotify_token_expires_at', expires_at);
          
          // Update the current request with new token
          config.headers.Authorization = `Bearer ${access_token}`;
          return config;
        }).catch(error => {
          console.log('Token refresh failed:', error);
          // Clear everything and redirect
          localStorage.clear();
          sessionStorage.clear();
          if (window.playlistCache) {
            window.playlistCache.flushAll();
          }
          window.location.href = '/';
          return Promise.reject(new Error('Token refresh failed'));
        });
      }
      
      // No refresh token available, clear everything
      localStorage.clear();
      sessionStorage.clear();
      if (window.playlistCache) {
        window.playlistCache.flushAll();
      }
      window.location.href = '/';
      return Promise.reject(new Error('No refresh token available'));
    }

    // Valid token, proceed with request
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.log('Received 401 response, clearing tokens and redirecting');
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all playlist caches
      if (window.playlistCache) {
        window.playlistCache.flushAll();
      }
      
      window.location.href = '/';
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

class SpotifyAPI {
  constructor() {
    this.accessToken = localStorage.getItem('spotify_access_token');
  }

  setAccessToken(token) {
    this.accessToken = token;
    localStorage.setItem('spotify_access_token', token);
  }

  getAccessToken() {
    return this.accessToken;
  }

  async request(method, endpoint, data = null) {
    try {
      const response = await axios({
        method,
        url: `${SPOTIFY_API_URL}${endpoint}`,
        data,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        // Retry the request once
        return await this.request(method, endpoint, data);
      }
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await api.get('/auth/refresh', {
        withCredentials: true
      });

      const { access_token, expires_in } = response.data;
      if (access_token) {
        this.setAccessToken(access_token);
        localStorage.setItem('spotify_token_expires_at', Date.now() + (expires_in * 1000));
        return access_token;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_token_expires_at');
      window.location.href = '/';
      throw error;
    }
  }

  // Spotify API Methods
  async getMe() {
    return this.request('GET', '/me');
  }

  async getMyTopTracks(timeRange = 'short_term', limit = 50) {
    return this.request('GET', `/me/top/tracks?time_range=${timeRange}&limit=${limit}`);
  }

  async getMyTopArtists(timeRange = 'short_term', limit = 50) {
    return this.request('GET', `/me/top/artists?time_range=${timeRange}&limit=${limit}`);
  }

  async getMyRecentlyPlayed(limit = 50) {
    return this.request('GET', `/me/player/recently-played?limit=${limit}`);
  }

  async play(deviceId, uris) {
    return this.request('PUT', `/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, {
      uris: Array.isArray(uris) ? uris : [uris]
    });
  }

  async pause(deviceId) {
    return this.request('PUT', `/me/player/pause${deviceId ? `?device_id=${deviceId}` : ''}`);
  }

  async seek(positionMs, deviceId) {
    return this.request('PUT', `/me/player/seek?position_ms=${positionMs}${deviceId ? `&device_id=${deviceId}` : ''}`);
  }
}

const spotifyApi = new SpotifyAPI();

export const refreshAccessToken = () => spotifyApi.refreshAccessToken();
export const isAuthenticated = () => !!spotifyApi.getAccessToken();

export const logout = () => {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_token_expires_at');
  window.location.href = '/';
};

export { api };
export default spotifyApi;
