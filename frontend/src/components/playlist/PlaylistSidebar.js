import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/playlist-container.css';

const PlaylistItem = ({ playlist, onClick, isSelected }) => (
  <button
    key={playlist.id}
    onClick={onClick}
    className={`group relative w-36 h-12 rounded-xl overflow-hidden transition-all hover:scale-105 ${
      isSelected 
        ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-black' 
        : ''
    }`}
    title={playlist.name}
  >
    <div className="absolute inset-0 flex items-center">
      <div className="relative w-12 h-12">
        <img 
          src={playlist.images[0]?.url || '/default-playlist.png'} 
          alt=""
          className="w-12 h-12 object-cover"
        />
      </div>
      <div className="flex-1 px-2 text-left truncate">
        <p className="text-xs font-medium text-white truncate">{playlist.name}</p>
        <p className="text-[10px] text-gray-400 truncate">
          {playlist.tracks?.total || 0} tracks
        </p>
      </div>
    </div>
  </button>
);

const NotchButton = ({ isOpen, onClick }) => (
  <motion.button
    onClick={onClick}
    className="absolute -right-6 top-[45%] -translate-y-1/2 w-6 h-16 bg-black/40 backdrop-blur-lg rounded-r-xl shadow-lg border border-white/5 group overflow-hidden"
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <motion.div 
      className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
      initial={false}
      animate={{ opacity: isOpen ? 0 : 0.3 }}
    />
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={false}
      animate={{ rotate: isOpen ? 180 : 0 }}
    >
      <svg 
        className="w-4 h-4 text-white/70 group-hover:text-white/90 transition-colors" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 19l-7-7 7-7" 
        />
      </svg>
    </motion.div>
  </motion.button>
);

const PlaylistSidebar = ({ playlists = [], selectedPlaylist, onPlaylistSelect }) => {
  const [isOpen, setIsOpen] = useState(true);
  const playlistArray = Array.isArray(playlists?.items) ? playlists.items : Array.isArray(playlists) ? playlists : [];

  const variants = {
    open: {
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 1,
        staggerChildren: 0.05,
      }
    },
    closed: {
      x: "calc(-100% - 1.5rem)", 
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 40,
        mass: 1,
        staggerChildren: 0.05,
        staggerDirection: -1,
      }
    }
  };

  const itemVariants = {
    open: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      }
    },
    closed: {
      x: -20,
      opacity: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      }
    }
  };

  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50">
      <motion.div
        initial="open"
        animate={isOpen ? "open" : "closed"}
        variants={variants}
        className="relative bg-black/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/5"
      >
        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto playlist-container py-3">
          <AnimatePresence mode="wait">
            {playlistArray.map((playlist, index) => (
              <motion.div
                key={`${playlist.id}-${index}`}
                variants={itemVariants}
                initial="closed"
                animate="open"
                exit="closed"
                custom={index}
                className="px-1.5"
              >
                <PlaylistItem
                  playlist={playlist}
                  onClick={() => onPlaylistSelect(playlist)}
                  isSelected={selectedPlaylist?.id === playlist.id}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <NotchButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
      </motion.div>
    </div>
  );
};

export default PlaylistSidebar;
