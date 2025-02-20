import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TimeRangeLabels } from '../../constants/timeRanges';

const AlbumItem = ({ album, index, onClick }) => (
  <motion.div
    className="group relative"
    whileHover={{ scale: 1.03 }}
    transition={{ type: "spring", stiffness: 400, damping: 25 }}
    onClick={() => onClick(album)}
  >
    <div className="relative aspect-square">
      <img
        src={album.images[0]?.url}
        alt={album.name}
        className="w-full h-full object-cover rounded-lg shadow-lg transition-all duration-300 group-hover:shadow-xl"
      />
      <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      </div>
    </div>
    <motion.div 
      className="mt-2"
      initial={{ opacity: 0.8 }}
      whileHover={{ opacity: 1 }}
    >
      <h3 className="font-medium truncate text-white group-hover:text-white/90 transition-colors">
        {index}. {album.name}
      </h3>
      <p className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors">
        {album.artists?.map(a => a.name).join(', ')}
      </p>
    </motion.div>
  </motion.div>
);

const MainPageAlbumList = ({ 
  albums, 
  title, 
  expandedSection,
  selectedTimeRange,
  onExpandSection,
  onAlbumSelect
}) => {
  const isExpanded = expandedSection === 'albums';
  const displayAlbums = albums.slice(0, 7);
  const hiddenAlbums = isExpanded ? albums.slice(7, 14) : [];

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-purple-400">Your top albums from {TimeRangeLabels[selectedTimeRange].toLowerCase()}</p>
        </div>
        <motion.button
          onClick={() => onExpandSection(isExpanded ? null : 'albums')}
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
        {displayAlbums.map((album, index) => (
          <div key={album.id} className="group">
            <AlbumItem album={album} index={index + 1} onClick={onAlbumSelect} />
          </div>
        ))}
        <AnimatePresence>
          {isExpanded && hiddenAlbums.map((album, index) => (
            <motion.div
              key={`${album.id}-${index}`}
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
              <AlbumItem album={album} index={index + 8} onClick={onAlbumSelect} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MainPageAlbumList;
