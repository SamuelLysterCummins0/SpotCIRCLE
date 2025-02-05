import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TimeRangeLabels } from '../../constants/timeRanges';

const ArtistItem = ({ artist, index }) => (
  <motion.div
    className="group relative"
    whileHover={{ scale: 1.03 }}
    transition={{ type: "spring", stiffness: 400, damping: 25 }}
  >
    <div className="relative aspect-square">
      <img
        src={artist.images[0]?.url}
        alt={artist.name}
        className="w-full h-full object-cover rounded-full shadow-lg transition-all duration-300 group-hover:shadow-xl"
      />
      <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      </div>
    </div>
    <motion.div 
      className="mt-2 text-center"
      initial={{ opacity: 0.8 }}
      whileHover={{ opacity: 1 }}
    >
      <h3 className="font-medium truncate text-white group-hover:text-white/90 transition-colors">
        {index}. {artist.name}
      </h3>
    </motion.div>
  </motion.div>
);

const MainPageArtistList = ({ 
  artists, 
  title, 
  expandedSection,
  selectedTimeRange,
  onExpandSection 
}) => {
  const isExpanded = expandedSection === 'artists';
  const displayArtists = artists.slice(0, 7);
  const hiddenArtists = isExpanded ? artists.slice(7, 21) : [];

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-purple-400">Your top artists from {TimeRangeLabels[selectedTimeRange].toLowerCase()}</p>
        </div>
        <motion.button
          onClick={() => onExpandSection(isExpanded ? null : 'artists')}
          className="p-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 
                   text-purple-400 hover:text-purple-300 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
          >
            <path d="M6 9l6 6 6-6"/>
          </motion.svg>
        </motion.button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {displayArtists.map((artist, index) => (
          <div key={artist.id} className="group">
            <ArtistItem artist={artist} index={index + 1} />
          </div>
        ))}
        <AnimatePresence>
          {isExpanded && hiddenArtists.map((artist, index) => (
            <motion.div
              key={`${artist.id}-${index}`}
              initial={{ 
                opacity: 0,
                scale: 0.6,
                y: 20
              }}
              animate={{ 
                opacity: 1,
                scale: 1,
                y: 0
              }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: "easeOut"
              }}
              className="group"
            >
              <ArtistItem artist={artist} index={index + 8} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MainPageArtistList;
