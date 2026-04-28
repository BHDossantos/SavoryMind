import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#08070d',
          900: '#0e0c17',
          800: '#161224',
          700: '#1f1a30',
          600: '#2a2342',
        },
        gold: {
          400: '#e7c878',
          500: '#d4af56',
          600: '#b89441',
        },
        accent: {
          500: '#ff5f6d',
          600: '#ff2e63',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
