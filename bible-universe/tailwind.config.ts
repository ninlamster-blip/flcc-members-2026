import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cosmos: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          800: '#0a0f2e',
          900: '#050818',
          950: '#020510',
        },
        gold: {
          300: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        node: {
          person:   '#FFD700',
          place:    '#4488FF',
          event:    '#FFFFFF',
          book:     '#AA44FF',
          prophecy: '#FF4444',
          doctrine: '#44FF88',
        },
      },
      fontFamily: {
        serif:   ['Georgia', 'Times New Roman', 'serif'],
        display: ['Georgia', 'serif'],
        mono:    ['ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow':        'glow 2.5s ease-in-out infinite',
        'float':       'float 6s ease-in-out infinite',
        'slide-in':    'slideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'fade-in':     'fadeIn 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: '1',  filter: 'brightness(1)' },
          '50%':      { opacity: '0.8', filter: 'brightness(1.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
