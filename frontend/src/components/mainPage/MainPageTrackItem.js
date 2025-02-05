import React from 'react';
import { motion } from 'framer-motion';

const MainPageTrackItem = ({ track, index, onClick }) => {
  return (
    <motion.div
      className="group relative"
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
    >
      <div className="relative aspect-square">
        <img
          src={track.album?.images[0]?.url}
          alt={track.name}
          className="w-full h-full object-cover rounded-lg shadow-lg transition-all duration-300 group-hover:shadow-xl"
        />
        <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <button className="p-3 bg-[#5B21B6] rounded-full hover:scale-105 transition-transform">
            <svg className="w-6 h-6" fill="white" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </div>
      <motion.div 
        className="mt-2"
        initial={{ opacity: 0.8 }}
        whileHover={{ opacity: 1 }}
      >
        <h3 className="font-medium truncate text-white group-hover:text-white/90 transition-colors">
          {index}. {track.name}
        </h3>
        <p className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors">
          {track.artists?.map(a => a.name).join(', ')}
        </p>
      </motion.div>
    </motion.div>
  );
};

export default MainPageTrackItem;
