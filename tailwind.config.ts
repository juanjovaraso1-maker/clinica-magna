import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"] },
      colors: {
        primary: {
          50:  "#f0f5ef",
          100: "#ddeadb",
          200: "#bad5b6",
          300: "#8fb98a",
          400: "#5f9659",
          500: "#4a7d49",
          600: "#3a6439",
          700: "#2e5030",
          800: "#223d24",
          900: "#1a2e1a",
          950: "#0f1c0f",
        },
      },
      boxShadow: {
        card: "0 2px 20px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 28px rgba(0,0,0,0.10)",
        modal: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
