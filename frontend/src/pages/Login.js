import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = 'http://localhost:5001/api';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const urlParams = new URLSearchParams(location.search);
      const error = urlParams.get('error');
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const userId = urlParams.get('user_id');

      if (error) {
        console.error('Auth error:', error);
        if (error === 'code_used') {
          setError('This login link has already been used. Please try logging in again.');
        } else {
          setError('Authentication failed. Please try again.');
        }
        return;
      }

      if (accessToken && refreshToken) {
        // Store tokens
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_refresh_token', refreshToken);
        if (userId) {
          localStorage.setItem('spotify_user_id', userId);
        }

        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Navigate to home
        navigate('/home');
        return;
      }

      // Check if we're already logged in
      const existingToken = localStorage.getItem('spotify_access_token');
      if (existingToken) {
        navigate('/home');
      }
    };

    checkAuth();
  }, [location, navigate]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Starting login process');
      
      const response = await axios.get(`${API_URL}/auth/login`);
      if (!response.data.url) {
        throw new Error('No login URL received');
      }
      
      console.log('Got login URL:', response.data.url);
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Error getting login URL:', error);
      setError('Failed to start login process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 to-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <div className="mt-4">Processing login...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-purple-900/10 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_65%)] from-purple-900/10" />
      </div>
      <div className="relative flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8 text-white bg-clip-text">SpotCIRCLE</h1>
          {error && (
            <div className="mb-4 text-red-500 bg-red-500/10 p-3 rounded-lg backdrop-blur-sm max-w-md">
              {error}
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="px-8 py-4 bg-purple-600 text-white rounded-full font-bold text-lg 
                     hover:bg-purple-500 transition-all duration-300 transform hover:scale-105
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                     shadow-lg shadow-purple-500/20"
          >
            {loading ? 'Connecting...' : 'Login with Spotify'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
