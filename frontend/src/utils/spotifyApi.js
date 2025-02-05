import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// Configure base axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('spotify_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
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

      const { access_token } = response.data;
      if (access_token) {
        this.setAccessToken(access_token);
        return access_token;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      localStorage.removeItem('spotify_access_token');
      window.location.href = '/login';
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
  window.location.href = '/login';
};

export { api };
export default spotifyApi;
