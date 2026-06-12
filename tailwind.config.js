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
          DEFAULT: "#FF6FA9",
          dark:    "#F85A9A",
          light:   "#FFF1F7",
        },
        neutral: {
          title:     "#1F2937",
          body:      "#374151",
          secondary: "#6B7280",
          disabled:  "#9CA3AF",
        },
        surface: {
          app:    "#F7F7F8",
          card:   "#FFFFFF",
          border: "#E9E9EE",
        },
        state: {
          success: "#22C55E",
          warning: "#F59E0B",
          error:   "#EF4444",
          info:    "#3B82F6",
        },
      },
      fontFamily: {
        geist:   ["'Geist'", "sans-serif"],
        display: ["'Geist'", "sans-serif"],
        body:    ["'Geist'", "sans-serif"],
      },
      borderRadius: {
        xl:    "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
    },
  },
  plugins: [],
}
