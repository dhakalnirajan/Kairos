/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#208AAE',
          light: '#4ECDC4',
          dark: '#1A6B85',
        },
        dark: {
          DEFAULT: '#1A1A2E',
          surface: '#16213E',
          border: '#3A3A5C',
        },
      },
    },
  },
  plugins: [],
}
