import React from 'react';
import { getPlaylistStats } from '../../utils/helpers';

const STAT_ICONS = {
  duration: (
    <svg className="w-5 h-5 text-purple-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  tracks: (
    <svg className="w-5 h-5 text-purple-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  saves: (
    <svg className="w-5 h-5 text-purple-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  lastUpdated: (
    <svg className="w-5 h-5 text-purple-400 relative transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
};

const StatItem = ({ icon, value, label }) => (
  <div className="group relative flex flex-col items-center">
    {/* Content */}
    <div className="relative flex flex-col items-center gap-1 group-hover:translate-y-[-2px] transition-all duration-300">
      {/* Icon container with glass effect */}
      <div className="relative mb-1">
        {/* Glass background */}
        <div className="absolute -inset-2 bg-purple-500/10 backdrop-blur-md rounded-lg scale-0 group-hover:scale-100 transition-transform duration-300"></div>
        
        {/* Icon glow */}
        <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-400/30 transition-all duration-300"></div>
        
        {/* Icon */}
        <div className="relative transform group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
      </div>

      {/* Value with glow effect */}
      <span className="text-purple-200 font-medium text-lg transform group-hover:translate-y-[-1px] transition-all duration-300">
        <span className="relative">
          {value}
          <div className="absolute inset-0 bg-purple-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </span>
      </span>
      
      {/* Label */}
      <span className="text-xs uppercase tracking-widest text-purple-400/70 transform group-hover:translate-y-[-1px] transition-all duration-300">
        {label}
      </span>
    </div>
  </div>
);

const PlaylistStats = ({ playlist, tracks, cachedStats }) => {
  return (
    <div className="grid grid-cols-4 gap-4 text-center py-4 border-t border-b border-purple-500/20">
      {/* Duration */}
      <StatItem 
        icon={STAT_ICONS.duration}
        value={cachedStats?.duration || '0 min'}
        label="Duration"
      />

      {/* Tracks */}
      <StatItem 
        icon={STAT_ICONS.tracks}
        value={cachedStats?.trackCount || 0}
        label="Tracks"
      />

      {/* Saves */}
      <StatItem 
        icon={STAT_ICONS.saves}
        value={cachedStats?.saves || 0}
        label="Saves"
      />

      {/* Last Updated */}
      <StatItem 
        icon={STAT_ICONS.lastUpdated}
        value={cachedStats?.lastUpdated || 'Recently'}
        label="Last Updated"
      />
    </div>
  );
};

export default PlaylistStats;
