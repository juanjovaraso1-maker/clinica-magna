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
        // Primary = blue accent system
        primary: {
          50:  "#EEF3FF",
          100: "#DDEAFF",
          200: "#BDD5FF",
          300: "#8DB8FF",
          400: "#5D96FF",
          500: "#3378FF",
          600: "#0057FF",
          700: "#0041CC",
          800: "#002E99",
          900: "#001D66",
          950: "#000E4D",
        },
        // Top-level semantic shortcuts
        accent:   { DEFAULT: "#0057FF", light: "#EEF3FF", dark: "#0041CC" },
        text2:    "#5A6072",
        text3:    "#9AA0B4",
        border2:  "#C8D0E0",
        surface2: "#F0F2F7",
        // Sidebar / dark surface
        sidebar:  "#1A1D2E",
        // Brand semantic palette
        brand: {
          bg:        "#F4F6FA",
          surface2:  "#F0F2F7",
          border:    "#E3E8F0",
          border2:   "#C8D0E0",
          text:      "#1A1D2E",
          text2:     "#5A6072",
          text3:     "#9AA0B4",
          green:     "#00A86B",
          "green-light": "#E6F7F1",
          red:       "#E53935",
          "red-light":   "#FDECEA",
          amber:     "#F59E0B",
          "amber-light": "#FEF3C7",
          purple:    "#7C3AED",
          "purple-light": "#EDE9FE",
          teal:      "#0891B2",
          "teal-light":  "#E0F2FE",
        },
      },
      boxShadow: {
        card:   "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
        modal:  "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
        sm2:    "0 1px 3px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
