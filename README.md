# SpotCIRCLE

A Spotify web player that enables users to explore their music listening habits, view top tracks, artists, and albums across different time periods. Features include full playback control, playlist management, queue manipulation, and real-time lyrics display with dynamic visualizations.

## Key Features

- **Music Analytics & Tracking**
  - View top tracks, artists, and albums across different time periods
  - Detailed playlist statistics and analytics
  - Real-time playback history
  - Smart playlist categorization and filtering
  - Cross-time period trend analysis
  - Personalized music recommendations

- **Advanced Playback Control**
  - System-wide music controls via custom PlayerNotch
  - Queue management and playlist handling
  - Real-time playback synchronization
  - Volume and progress control
  - Advanced playlist sorting and filtering
  - Drag-and-drop queue management
  - Seamless device switching

- **Enhanced Music Experience**
  - Real-time lyrics integration via Genius API
  - Dynamic color extraction from album artwork
  - Fluid gradient animations
  - Cross-platform desktop integration
  - Real-time collaborative playlist editing
  - Smart shuffle with genre awareness
  - Customizable audio visualizations

- **Performance Optimizations**
  - Multi-layer caching system (memory + localStorage)
  - Intelligent request queue with rate limiting
  - Debounced state updates
  - Optimized API request handling
  - Progressive web app capabilities
  - Offline mode support
  - Background data prefetching

## Technical Stack

- **Frontend**
  - React.js with Context API
  - Tailwind CSS
  - Spotify Web Playback SDK
  - Custom animations and transitions
  - Real-time state synchronization
  - WebSocket integration
  - Service Worker implementation

- **Backend**
  - Node.js with Express
  - OAuth2 authentication
  - Genius API integration
  - Advanced caching system
  - Rate limiting middleware
  - WebSocket server
  - Redis for session management

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Spotify Developer Account
- Genius API credentials

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create .env file with your credentials:
   ```
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   GENIUS_ACCESS_TOKEN=your_genius_token
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## Project Structure

```
spotcircle/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── spotify.js
│   │   │   └── genius.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── geniusController.js
│   │   │   ├── spotifyController.js
│   │   │   └── userController.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── genius.js
│   │   │   ├── spotify.js
│   │   │   └── user.js
│   │   ├── utils/
│   │   │   ├── cache.js
│   │   │   └── requestQueue.js
│   │   ├── server.js
│   │   └── index.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── player/
│   │   │   │   ├── PlayerNotch.js
│   │   │   │   └── SpotifyPlayer.js
│   │   │   ├── playlist/
│   │   │   │   ├── PlaylistHeader.js
│   │   │   │   └── PlaylistView.js
│   │   │   └── background/
│   │   │       └── AnimatedBackground.js
│   │   ├── contexts/
│   │   │   └── PlayerContext.js
│   │   ├── hooks/
│   │   │   └── usePlayerStateUpdate.js
│   │   ├── pages/
│   │   │   ├── Home.js
│   │   │   └── Login.js
│   │   ├── utils/
│   │   │   ├── spotifyApi.js
│   │   │   ├── cacheManager.js
│   │   │   └── helpers.js
│   │   ├── styles/
│   │   │   └── tailwind.css
│   │   └── App.js
│   ├── tailwind.config.js
│   └── package.json
└── README.md

## Features in Development

- System tray integration
- Enhanced desktop controls
- Advanced playlist analytics
- Offline mode support

## License

This project is licensed under the MIT License.
