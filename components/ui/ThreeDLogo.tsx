import React from 'react'

export function ThreeDLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Soft glowing backdrop */}
      <div className="absolute inset-0 bg-blue-400/20 rounded-3xl blur-xl animate-pulse" />
      
      {/* Glassy 3D container */}
      <div 
        className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-white/60 backdrop-blur-md border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-transform duration-700 hover:scale-105 hover:rotate-3"
        style={{
          boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.8), 0 10px 30px rgba(59, 130, 246, 0.15)',
          transformStyle: 'preserve-3d',
          transform: 'perspective(1000px) rotateX(10deg) rotateY(-10deg)',
        }}
      >
        {/* Floating R */}
        <div 
          className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-indigo-800"
          style={{
            transform: 'translateZ(20px)',
            filter: 'drop-shadow(0 10px 10px rgba(59, 130, 246, 0.3))',
          }}
        >
          R
        </div>
      </div>
    </div>
  )
}
