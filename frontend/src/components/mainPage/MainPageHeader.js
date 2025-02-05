import React from 'react';

const MainPageHeader = ({ onLogout }) => {
  return (
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-purple-400">
        SpotCIRCLE
      </h1>
      <button
        onClick={onLogout}
        className="px-4 py-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30 
                 text-purple-400 hover:text-purple-300 transition-all duration-300 
                 border border-purple-500/20 backdrop-blur-sm"
      >
        Logout
      </button>
    </div>
  );
};

export default MainPageHeader;
