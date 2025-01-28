// Utility functions for Spotify SDK management

let sdkInitialized = false;

export const clearSDKStorage = () => {
  Object.keys(sessionStorage).forEach(key => {
    if (key.includes('sdk.scdn.co')) {
      sessionStorage.removeItem(key);
    }
  });
};

export const initializeSpotifySDK = () => {
  return new Promise((resolve) => {
    if (window.Spotify) {
      sdkInitialized = true;
      resolve();
      return;
    }

    if (!document.getElementById('spotify-player-script')) {
      const script = document.createElement("script");
      script.id = 'spotify-player-script';
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;

      window.onSpotifyWebPlaybackSDKReady = () => {
        sdkInitialized = true;
        resolve();
      };

      script.onerror = (error) => {
        console.error('Failed to load Spotify SDK:', error);
        resolve(); // Resolve anyway to prevent hanging
      };

      document.body.appendChild(script);
    } else {
      // If script exists but SDK isn't ready, wait for the event
      window.onSpotifyWebPlaybackSDKReady = () => {
        sdkInitialized = true;
        resolve();
      };
    }
  });
};
