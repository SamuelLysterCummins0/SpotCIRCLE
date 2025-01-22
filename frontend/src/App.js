import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlayerProvider } from './contexts/PlayerContext';

// Import pages
import Home from './pages/Home';
import Login from './pages/Login';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <PlayerProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-gradient-to-b from-purple-900 to-black text-white"
      >
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/callback" element={<Login />} />
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          {/* Catch all other routes and redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </PlayerProvider>
  );
}

export default App;
