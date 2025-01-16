# SpotCircle

A music-based social platform that connects people through their musical tastes using Spotify integration.

## Features

- Spotify OAuth Integration
- Music-Based Profile System
- Card-Based Discovery
- Interactive Music Games
- Real-time Chat with Music Sharing
- Privacy-Focused Design

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis (optional)
- Spotify Developer Account

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy .env.example to .env and fill in your configuration:
   ```bash
   cp .env.example .env
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
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── server.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License.
