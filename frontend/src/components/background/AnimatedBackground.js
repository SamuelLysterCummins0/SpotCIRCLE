import React from 'react';

const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden bg-black">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-black opacity-90" />

      {/* Animated gradients */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Center black hole effect */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%]">
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.95) 30%, rgba(0, 0, 0, 0.98) 50%)'
          }} />
        </div>

        {/* Moving gradients - Center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] moving-gradient">
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.6) 0%, rgba(88, 28, 135, 0.2) 20%, transparent 40%)'
          }} />
        </div>

        {/* Moving gradients - Left */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[200%] h-[200%] moving-gradient-slow" style={{ animationDelay: '-2s' }}>
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.2) 25%, transparent 45%)'
          }} />
        </div>

        {/* Moving gradients - Right */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[200%] h-[200%] moving-gradient" style={{ animationDelay: '-4s' }}>
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.2) 25%, transparent 45%)'
          }} />
        </div>

        {/* Moving gradients - Top */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[200%] h-[200%] moving-gradient-fast" style={{ animationDelay: '-3s' }}>
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.2) 25%, transparent 45%)'
          }} />
        </div>

        {/* Moving gradients - Bottom */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[200%] h-[200%] moving-gradient-slow" style={{ animationDelay: '-5s' }}>
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.2) 25%, transparent 45%)'
          }} />
        </div>

        {/* Additional floating gradients */}
        <div className="absolute left-1/4 top-1/4 w-[150%] h-[150%] moving-gradient" style={{ animationDelay: '-1s' }}>
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.25) 20%, transparent 40%)'
          }} />
        </div>

        <div className="absolute right-1/4 bottom-1/4 w-[150%] h-[150%] moving-gradient-fast" style={{ animationDelay: '-6s' }}>
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.5) 0%, rgba(88, 28, 135, 0.25) 20%, transparent 40%)'
          }} />
        </div>
      </div>

      {/* Dark overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black opacity-80" />
      <div className="absolute inset-0 bg-black opacity-40" />
    </div>
  );
};

export default AnimatedBackground;
