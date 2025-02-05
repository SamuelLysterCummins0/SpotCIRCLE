import React from 'react';
import { decodeHtmlEntities } from '../../utils/helpers';

const PlaylistHeader = ({ playlist, onBack }) => {
  return (
    <div className="flex items-start gap-4">
      <button 
        onClick={onBack} 
        className="p-2 hover:bg-white/10 rounded-full transition-colors"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="flex flex-col items-start w-full">
        <div className="relative flex flex-col w-full">
          <h1 className="text-3xl font-bold text-white mb-8 pl-4">{playlist?.name}</h1>
          <div className="relative mb-10 group w-full px-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 to-purple-900/20 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-full h-52 rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/40 to-black/40 p-6">
              {/* Decorative circles */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-600/10 rounded-full blur-2xl transform translate-x-1/4 translate-y-1/4"></div>
              
              {/* Content container */}
              <div className="flex items-center justify-between h-full">
                {/* Left side info */}
                <div className="w-1/4 text-white/80 space-y-4">
                  <div className="space-y-1">
                    <div className="text-sm uppercase tracking-wider text-purple-300/70">Created by</div>
                    <div className="font-medium text-base truncate drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{playlist?.owner?.display_name}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm uppercase tracking-wider text-purple-300/70">Followers</div>
                    <div className="font-medium text-base drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{playlist?.followers?.total || 0}</div>
                  </div>
                </div>

                {/* Left decorative element */}
                <div className="relative w-24 h-full">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[1px] h-24 bg-gradient-to-b from-transparent via-purple-500/30 to-transparent"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/5 to-purple-600/5 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-purple-400/40"></div>
                    </div>
                  </div>
                </div>

                {/* Center - Album cover with glow */}
                <div className="relative w-39 h-40 -ml-12">
                  {/* Glow effects */}
                  <div className="absolute inset-0 bg-purple-500/10 rounded-lg blur-xl"></div>
                  <div className="absolute inset-0 bg-purple-600/5 rounded-lg blur-md"></div>
                  {/* Backdrop */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-black/40 rounded-lg backdrop-blur-sm"></div>
                  <img 
                    src={playlist?.images?.[0]?.url} 
                    alt={playlist?.name}
                    className="relative w-full h-full object-contain rounded-lg shadow-xl"
                  />
                  {/* Additional glow overlay */}
                  <div className="absolute inset-0 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.15)] pointer-events-none"></div>
                </div>

                {/* Right decorative element */}
                <div className="relative w-24 h-full">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[1px] h-24 bg-gradient-to-b from-transparent via-purple-500/30 to-transparent"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/5 to-purple-600/5 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-purple-400/40"></div>
                    </div>
                  </div>
                </div>

                {/* Right side info */}
                <div className="w-1/4 text-right text-white/80 space-y-4">
                  <div className="space-y-1">
                    <div className="text-sm uppercase tracking-wider text-purple-300/70">Playlist Type</div>
                    <div className="font-medium text-base capitalize drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{playlist?.public ? 'Public' : 'Private'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm uppercase tracking-wider text-purple-300/70">Description</div>
                    <div className="font-medium text-base break-words drop-shadow-[0_0_3px_rgba(168,85,247,0.3)]">{decodeHtmlEntities(playlist?.description) || 'No description'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistHeader;
