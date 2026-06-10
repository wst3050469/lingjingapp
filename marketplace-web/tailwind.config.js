/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#00f5ff',
          purple: '#bf00ff',
          blue: '#4d7cff',
          pink: '#ff00e5',
        },
        dark: {
          900: '#0a0a0f',
          800: '#0f0f1a',
          700: '#161625',
          600: '#1e1e32',
          500: '#2a2a42',
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 245, 255, 0.3), 0 0 60px rgba(0, 245, 255, 0.1)',
        'neon-purple': '0 0 20px rgba(191, 0, 255, 0.3), 0 0 60px rgba(191, 0, 255, 0.1)',
        'neon-blue': '0 0 20px rgba(77, 124, 255, 0.3), 0 0 60px rgba(77, 124, 255, 0.1)',
      },
    },
  },
  plugins: [],
};