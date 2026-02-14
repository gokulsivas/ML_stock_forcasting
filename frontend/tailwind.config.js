/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0f172a',
        'dark-card': '#1e293b',
        'dark-border': '#334155',
        'dark-hover': '#475569',
        'light-bg': '#f8fafc',
        'light-card': '#ffffff',
        'light-border': '#e2e8f0',
        'light-hover': '#cbd5e1',
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-in',
        'shimmer': 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [],
}
