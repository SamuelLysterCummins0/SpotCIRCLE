import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MainPageTrackItem from './MainPageTrackItem';
import TimeRangeSelector from '../timeRange/TimeRangeSelector';
import { TimeRangeLabels } from '../../constants/timeRanges';

const MainPageTrackList = ({ 
  tracks, 
  title, 
  expandedSection,
  selectedTimeRange,
  onTimeRangeChange,
  onExpandSection,
  onTrackSelect 
}) => {
  const isExpanded = expandedSection === 'tracks';
  const displayTracks = tracks.slice(0, 7);
  const hiddenTracks = isExpanded ? tracks.slice(7, 28) : [];

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-purple-400">Your top tracks from {TimeRangeLabels[selectedTimeRange].toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-4">
          <TimeRangeSelector 
            selectedTimeRange={selectedTimeRange} 
            onTimeRangeChange={onTimeRangeChange} 
          />
          <motion.button
            onClick={() => onExpandSection(isExpanded ? null : 'tracks')}
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
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {displayTracks.map((track, index) => (
          <div key={track.id}>
            <MainPageTrackItem
              track={track}
              index={index + 1}
              onClick={() => onTrackSelect(track, tracks)}
            />
          </div>
        ))}
        <AnimatePresence>
          {isExpanded && hiddenTracks.map((track, index) => (
            <motion.div
              key={`${track.id}-${index}`}
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
            >
              <MainPageTrackItem
                track={track}
                index={index + 8}
                onClick={() => onTrackSelect(track, tracks)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MainPageTrackList;
