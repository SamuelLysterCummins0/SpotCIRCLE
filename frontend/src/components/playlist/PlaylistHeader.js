import React from 'react';
import { decodeHtmlEntities } from '../../utils/helpers';

const PlaylistHeader = ({ playlist, onBack, tracks, cachedStats }) => {
  const StatItem = ({ icon, label, value }) => (
    <div className="group relative">
      {/* Content */}
      <div className="relative flex items-center gap-3 text-purple-300 px-4 group-hover:translate-y-[-2px] transition-all duration-300">
        {/* Icon container with glass effect */}
        <div className="relative">
          {/* Glass background */}
          <div className="absolute -inset-2 bg-purple-500/10 backdrop-blur-md rounded-lg scale-0 group-hover:scale-100 transition-transform duration-300"></div>
          
          {/* Icon glow */}
          <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-400/30 transition-all duration-300"></div>
          
          {/* Icon */}
          <div className="relative transform group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
        </div>
        
        {/* Text content */}
        <div className="flex flex-col relative">
          {/* Value with glow effect */}
          <span className="text-purple-200 font-medium transform group-hover:translate-x-1 transition-all duration-300">
            <span className="relative">
              {value}
              <div className="absolute inset-0 bg-purple-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </span>
          </span>
          
          {/* Label with slide effect */}
          <span className="text-xs uppercase tracking-widest text-purple-400/70 transform group-hover:translate-x-0.5 transition-all duration-300">
            {label}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full mb-8 mt-10">
      <div className="relative flex items-start gap-8 p-6 bg-black/10 rounded-xl backdrop-blur-sm">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="text-purple-300 hover:text-purple-100 transition-colors p-2 -ml-2 hover:bg-purple-500/10 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Playlist Image */}
        <div className="relative group">
          <div className="absolute inset-0 bg-purple-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <img 
            src={playlist?.images?.[0]?.url || '/default-playlist.png'} 
            alt={playlist?.name} 
            className="w-48 h-48 object-cover rounded-lg shadow-lg shadow-purple-900/50"
          />
        </div>

        {/* Playlist Info */}
        <div className="flex-1 pt-2">
          <h1 className="text-5xl font-bold text-purple-50 mb-4 drop-shadow-[0_2px_4px_rgba(168,85,247,0.4)]">
            {decodeHtmlEntities(playlist?.name)}
          </h1>
          <p className="text-purple-300 mb-6 line-clamp-2 max-w-2xl">
            {decodeHtmlEntities(playlist?.description)}
          </p>
          
          {/* Stats */}
          <div className="flex items-center gap-10">
            {/* Owner */}
            <StatItem 
              icon={
                <svg className="w-5 h-5 text-purple-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              value={cachedStats?.creator || playlist?.owner?.display_name}
              label="Creator"
            />

            {/* Artists Count */}
            <StatItem 
              icon={
                <svg className="w-5 h-5 text-purple-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
              value={`${cachedStats?.uniqueArtists || 0} Artists`}
              label="Unique"
            />

            {/* Public/Private */}
            <StatItem 
              icon={
                <svg className="w-5 h-5 text-purple-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {playlist?.public ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  )}
                </svg>
              }
              value={cachedStats?.visibility || (playlist?.public ? 'Public' : 'Private')}
              label="Visibility"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistHeader;
