import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      colors: {
        primary: {
          50:  "#f2f5f0",
          100: "#e2eade",
          200: "#c4d5bc",
          300: "#9ab893",
          400: "#6f9769",
          500: "#588157",
          600: "#476847",
          700: "#3a5a40",
          800: "#2d4535",
          900: "#1e2e24",
          950: "#111c15",
        },
      },
    },
  },
  plugins: [],
};

export default config;
