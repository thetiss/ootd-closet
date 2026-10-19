/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf4ef',
          100: '#fbe5d8',
          200: '#f5c6ad',
          300: '#efa17a',
          400: '#e57547',
          500: '#d95822',
          600: '#c44317',
          700: '#a43313',
          800: '#852a15',
          900: '#6f2515',
        },
      },
    },
  },
  plugins: [],
};
