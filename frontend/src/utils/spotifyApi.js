import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5001';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// One source of truth for clearing local state and bouncing to login.
const handleAuthFailure = () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/';
};

// Single token-refresh entry point used by the axios interceptor below and by
// the Web Playback SDK callback. Refresh requests are de-duped via a shared
// promise so concurrent 401s only trigger one /auth/refresh call.
let refreshPromise = null;
export const refreshSpotifyToken = () => {
  if (refreshPromise) return refreshPromise;

  const refresh_token = localStorage.getItem('spotify_refresh_token');
  if (!refresh_token) {
    handleAuthFailure();
    return Promise.reject(new Error('No refresh token'));
  }

  refreshPromise = axios
    .get(`${API_URL}/api/auth/refresh`, {
      params: { refresh_token },
      headers: {
        'X-User-Id': localStorage.getItem('spotify_user_id') || '',
      },
    })
    .then((res) => {
      const { access_token, expires_at, expires_in } = res.data;
      localStorage.setItem('spotify_access_token', access_token);
      if (expires_at) {
        localStorage.setItem('spotify_token_expires_at', expires_at);
      } else if (expires_in) {
        localStorage.setItem(
          'spotify_token_expires_at',
          String(Date.now() + expires_in * 1000),
        );
      }
      return access_token;
    })
    .catch((err) => {
      handleAuthFailure();
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the current token + user id to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('spotify_access_token');
  const userId = localStorage.getItem('spotify_user_id');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (userId) {
    config.headers['X-User-Id'] = userId;
  }
  return config;
});

// On 401, try a single token refresh and replay the original request.
// If the refresh itself fails (or the retry 401s again), we bounce to login.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      try {
        const newToken = await refreshSpotifyToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  },
);

// Direct Spotify Web API helper (used in a couple of spots).
class SpotifyAPI {
  async request(method, endpoint, data = null) {
    const token = localStorage.getItem('spotify_access_token');
    try {
      const response = await axios({
        method,
        url: `${SPOTIFY_API_URL}${endpoint}`,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await refreshSpotifyToken();
        return this.request(method, endpoint, data);
      }
      throw error;
    }
  }

  getMe() {
    return this.request('GET', '/me');
  }
  getMyTopTracks(timeRange = 'short_term', limit = 50) {
    return this.request('GET', `/me/top/tracks?time_range=${timeRange}&limit=${limit}`);
  }
  getMyTopArtists(timeRange = 'short_term', limit = 50) {
    return this.request('GET', `/me/top/artists?time_range=${timeRange}&limit=${limit}`);
  }
  getMyRecentlyPlayed(limit = 50) {
    return this.request('GET', `/me/player/recently-played?limit=${limit}`);
  }
  play(deviceId, uris) {
    return this.request(
      'PUT',
      `/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`,
      { uris: Array.isArray(uris) ? uris : [uris] },
    );
  }
  pause(deviceId) {
    return this.request('PUT', `/me/player/pause${deviceId ? `?device_id=${deviceId}` : ''}`);
  }
  seek(positionMs, deviceId) {
    return this.request(
      'PUT',
      `/me/player/seek?position_ms=${positionMs}${deviceId ? `&device_id=${deviceId}` : ''}`,
    );
  }
}

const spotifyApi = new SpotifyAPI();

export const isAuthenticated = () => !!localStorage.getItem('spotify_access_token');

export const logout = () => {
  handleAuthFailure();
};

export { api };
export default spotifyApi;
