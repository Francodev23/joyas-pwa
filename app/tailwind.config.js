/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          deep: '#96712c',
          main: '#b8924a',
          light: '#e5c78a',
        },
        bg: {
          dark: '#1a1610',
          darker: '#050505',
        }
      },
    },
  },
  plugins: [],
}

