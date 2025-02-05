import React from 'react';
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

const PlaylistSidebar = ({ playlists, selectedPlaylist, onPlaylistSelect }) => {
  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50">
      <div className="bg-black/40 backdrop-blur-lg rounded-2xl shadow-xl border border-white/5">
        <div 
          className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto playlist-container"
        >
          {playlists.map((playlist, index) => (
            <div key={`${playlist.id}-${index}`}>
              <PlaylistItem
                playlist={playlist}
                onClick={() => onPlaylistSelect(playlist)}
                isSelected={selectedPlaylist?.id === playlist.id}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaylistSidebar;
