import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = 'http://localhost:5001/api';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  const handleCallback = useCallback(async (code) => {
    if (isProcessingCallback) return;
    
    try {
      setIsProcessingCallback(true);
      setLoading(true);
      setError(null);
      console.log('Handling Spotify callback with code');
      
      // Clear any existing tokens before getting new ones
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_refresh_token');
      localStorage.removeItem('spotify_user_id');

      const response = await axios.get(`${API_URL}/auth/callback`, {
        params: { code }
      });

      console.log('Got response from backend');
      const { access_token, refresh_token, userId } = response.data;
      
      if (!access_token || !refresh_token) {
        throw new Error('Invalid response from server - missing tokens');
      }

      localStorage.setItem('spotify_access_token', access_token);
      localStorage.setItem('spotify_refresh_token', refresh_token);
      if (userId) {
        localStorage.setItem('spotify_user_id', userId);
      }

      navigate('/home');
    } catch (error) {
      console.error('Error during callback:', error);
      let errorMessage = 'Failed to complete login. Please try again.';
      if (error.response?.data?.details) {
        errorMessage += ` (${error.response.data.details})`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsProcessingCallback(false);
    }
  }, [navigate, isProcessingCallback]);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if we're handling the callback from Spotify
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      
      if (error) {
        console.error('Spotify auth error:', error);
        setError('Authentication failed. Please try again.');
        return;
      }
      
      if (code) {
        // Remove code from URL to prevent reuse
        window.history.replaceState({}, document.title, window.location.pathname);
        await handleCallback(code);
      } else {
        // Check if we're already logged in
        const token = localStorage.getItem('spotify_access_token');
        if (token) {
          navigate('/home');
        }
      }
    };

    checkAuth();
  }, [location, navigate, handleCallback]);

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 to-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-8">Welcome to SpotCIRCLE</h1>
        {error && (
          <div className="mb-4 text-red-500 bg-red-100/10 p-3 rounded max-w-md">
            {error}
          </div>
        )}
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`px-8 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors duration-200 flex items-center space-x-2 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span>Login with Spotify</span>
        </button>
      </div>
    </div>
  );
};

export default Login;
