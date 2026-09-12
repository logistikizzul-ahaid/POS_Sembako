/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf3', 100: '#d6fae2', 500: '#16a34a', 600: '#15803d', 700: '#166534'
        }
      }
    },
  },
  plugins: [],
}
