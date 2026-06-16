/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Varela Round"', 'sans-serif'],
        body: ['"Nunito Sans"', 'sans-serif'],
      },
      animation: {
        'blob': 'blob 8s infinite ease-in-out',
        'blob-delayed': 'blob 10s infinite ease-in-out 3s',
        'blob-slow': 'blob 12s infinite ease-in-out 1.5s',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -40px) scale(1.08)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.94)' },
        },
      },
    },
  },
  plugins: [],
}
