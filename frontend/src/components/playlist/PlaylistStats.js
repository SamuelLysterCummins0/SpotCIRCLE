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
  lastUpdated: (
    <svg className="w-5 h-5 text-purple-400 relative transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
};

const StatItem = ({ icon, value, label }) => (
  <div className="group relative">
    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-gradient-to-b from-purple-500/50 to-transparent"></div>
    <div className="flex flex-col items-center pt-10 px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
        {icon}
      </div>
      <span className="text-purple-300 font-medium mt-2 text-lg drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{value}</span>
      <span className="text-xs uppercase tracking-widest text-purple-400/70 mt-1">{label}</span>
    </div>
  </div>
);

const PlaylistStats = ({ playlist, tracks }) => {
  const { duration, trackCount, lastUpdated } = getPlaylistStats(playlist, tracks);

  return (
    <>
      <div className="flex items-center justify-between w-full relative -mt-4 px-4">
        <StatItem 
          icon={STAT_ICONS.duration}
          value={duration}
          label="Duration"
        />

        <StatItem 
          icon={STAT_ICONS.tracks}
          value={trackCount}
          label="Tracks"
        />

        <StatItem 
          icon={STAT_ICONS.lastUpdated}
          value={lastUpdated}
          label="Last Updated"
        />
      </div>

      <div className="w-full h-[2px] mt-4 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
    </>
  );
};

export default PlaylistStats;
