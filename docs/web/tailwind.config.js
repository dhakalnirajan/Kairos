/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kairos: {
          bg: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          primary: '#38bdf8',
          secondary: '#94a3b8',
          accent: '#22d3ee',
          success: '#4ade80',
          error: '#f87171',
          warning: '#fbbf24',
          text: '#e2e8f0',
          muted: '#64748b',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Noto Sans', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Fira Mono', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
