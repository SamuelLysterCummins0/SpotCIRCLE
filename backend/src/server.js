const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const SpotifyWebApi = require('spotify-web-api-node');
const authRoutes = require('./routes/auth');
const tracksRoutes = require('./routes/tracks');
const artistsRoutes = require('./routes/artists');

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Make spotifyApi available in routes
app.use((req, res, next) => {
  req.spotifyApi = spotifyApi;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tracks', tracksRoutes);
app.use('/api/artists', artistsRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('SpotCIRCLE API is running');
});

const port = process.env.PORT || 5001;
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
