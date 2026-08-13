/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf3",
          100: "#d6f5e1",
          200: "#b0eac8",
          300: "#7bd8a9",
          400: "#45bd87",
          500: "#22a06d",
          600: "#158058",
          700: "#12654a",
          800: "#12503c",
          900: "#104233",
        },
      },
    },
  },
  plugins: [],
};
