import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { timeRanges } from '../../constants/timeRanges';

const TimeRangeSelector = ({ selectedTimeRange, onTimeRangeChange }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="group relative px-4 py-2 overflow-hidden rounded-lg bg-gradient-to-br from-purple-900/40 to-black/40 hover:from-purple-800/40 hover:to-purple-900/40 transition-colors duration-300"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>
        <div className="relative flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium">
            {timeRanges.find(range => range.id === selectedTimeRange)?.label}
          </span>
          <svg className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-48 rounded-lg bg-gradient-to-br from-purple-900/95 to-black/95 backdrop-blur-sm shadow-xl z-50 overflow-hidden"
          >
            <div className="py-1">
              {timeRanges.map((range) => (
                <button
                  key={range.id}
                  onClick={() => {
                    onTimeRangeChange(range.id);
                    setShowDropdown(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-white/10 transition-colors ${
                    selectedTimeRange === range.id ? 'bg-purple-700/30 text-purple-300' : 'text-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimeRangeSelector;
