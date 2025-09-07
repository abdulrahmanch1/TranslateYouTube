export default {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E9F5FF',
          100: '#CFEAFF',
          200: '#9FD4FF',
          300: '#6FBFFF',
          400: '#3FA9FF',
          500: '#0F93FF',
          600: '#0C74CC',
          700: '#095699',
          800: '#063766',
          900: '#031933',
        },
        neon: '#53FFE9',
        ink: '#0B0F14',
      },
      backgroundImage: {
        'grid-neon':
          'radial-gradient(circle at 1px 1px, rgba(83,255,233,0.18) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-sm': '24px 24px',
      },
      animation: {
        float: 'float 10s ease-in-out infinite',
        pulseGlow: 'pulseGlow 4s ease-in-out infinite',
        driftSlow: 'drift 32s ease-in-out infinite',
        driftSlower: 'drift 52s ease-in-out infinite',
        panGrid: 'pan 30s linear infinite',
        spinSlow: 'spinSlow 60s linear infinite',
        scanY: 'scanY 14s ease-in-out infinite',
        twinkle: 'twinkle 3.6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: 0.5 },
          '50%': { opacity: 1 },
        },
        drift: {
          '0%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(6%, -4%, 0) scale(1.05)' },
          '100%': { transform: 'translate3d(0,0,0) scale(1)' },
        },
        pan: {
          '0%': { backgroundPosition: '0px 0px' },
          '100%': { backgroundPosition: '200px 200px' },
        },
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        scanY: {
          '0%, 100%': { transform: 'translateY(-20%)', opacity: 0.15 },
          '50%': { transform: 'translateY(20%)', opacity: 0.35 },
        },
        twinkle: {
          '0%, 100%': { opacity: 0.2 },
          '50%': { opacity: 0.8 },
        },
      },
    },
  },
  plugins: [],
}
