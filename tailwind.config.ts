import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Stadium at night" base
        pitch: {
          950: '#06140c',
          900: '#0a1f12',
          800: '#0f2e1b',
          700: '#16432a',
          600: '#1d5836',
        },
        // CRT ticker glow
        crt: {
          amber: '#ffb000',
          green: '#39ff14',
          dim: '#1f3b25',
        },
        chrome: {
          DEFAULT: '#e6e8e3',
          muted: '#9aa39b',
        },
        // Redesign elevation steps — cards layer on these instead of borders
        // doing all the work (design-mockups/05-system.html).
        surface: {
          1: '#0c1d12',
          2: '#12271a',
          3: '#1a3322',
        },
        // Player-quality tiers (OVR badges, stat colours) — one scale everywhere.
        tier: {
          elite: '#4ade80',
          good: '#a3e635',
          ok: '#fbbf24',
          low: '#fb923c',
          poor: '#f87171',
        },
      },
      fontFamily: {
        ticker: ['"VT323"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        // Data readouts (scores, money, table numbers) — readable at 12px where
        // VT323 isn't. The ticker font stays for match-feed flavour.
        data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        display: ['"Oswald"', '"Bebas Neue"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 0 0 rgba(0,0,0,0.45), 0 10px 20px -6px rgba(0,0,0,0.6)',
        glow: '0 0 12px rgba(57,255,20,0.45)',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.7' },
          '94%': { opacity: '1' },
        },
      },
      animation: {
        flicker: 'flicker 4s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
