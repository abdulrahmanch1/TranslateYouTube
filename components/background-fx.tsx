"use client"
import React from 'react'

export function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Large drifting glow blobs */}
      <div
        className="absolute -top-1/3 -left-1/4 w-[60vw] h-[60vw] rounded-full blur-3xl animate-driftSlow"
        style={{
          background:
            'radial-gradient(closest-side, rgba(15,147,255,0.28), rgba(15,147,255,0.10), transparent)'
        }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 w-[55vw] h-[55vw] rounded-full blur-3xl animate-driftSlower"
        style={{
          background:
            'radial-gradient(closest-side, rgba(83,255,233,0.22), rgba(83,255,233,0.10), transparent)'
        }}
      />

      {/* Subtle animated grid overlay */}
      <div
        className="absolute inset-0 opacity-25 bg-grid-neon bg-grid-sm animate-panGrid"
        style={{
          maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black, transparent 70%)',
        }}
      />

      {/* Rotating conic ring in the middle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          aria-hidden
          className="relative w-[55vmin] h-[55vmin] rounded-full opacity-30 animate-spinSlow"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(83,255,233,0.0), rgba(83,255,233,0.35), rgba(15,147,255,0.0))',
            maskImage:
              'radial-gradient(circle, transparent 40%, black 41%, black 60%, transparent 61%)',
            WebkitMaskImage:
              'radial-gradient(circle, transparent 40%, black 41%, black 60%, transparent 61%)',
            filter: 'blur(2px)'
          }}
        />
      </div>

      {/* Removed scanning beam as requested */}

      {/* Twinkling stars (light dots) */}
      <Stars />
    </div>
  )
}

function Stars() {
  // مواقع ثابتة لضمان أداء ثابت و SSR متسق
  const pts = [
    { left: '12%', top: '22%', delay: '0s', size: 3 },
    { left: '28%', top: '12%', delay: '0.6s', size: 2 },
    { left: '44%', top: '18%', delay: '1.2s', size: 2 },
    { left: '66%', top: '14%', delay: '0.9s', size: 3 },
    { left: '82%', top: '24%', delay: '0.3s', size: 2 },
    { left: '18%', top: '68%', delay: '1.5s', size: 2 },
    { left: '36%', top: '72%', delay: '0.2s', size: 3 },
    { left: '58%', top: '78%', delay: '1.1s', size: 2 },
    { left: '74%', top: '66%', delay: '0.7s', size: 3 },
    { left: '88%', top: '74%', delay: '1.8s', size: 2 },
  ] as const
  return (
    <div className="absolute inset-0">
      {pts.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            boxShadow: '0 0 8px rgba(255,255,255,0.7)'
          }}
        />
      ))}
    </div>
  )
}
