import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        vbsk: {
          red: "#DC2626",
          dark: "#1F2937",
        },
        arcade: {
          black: "#0a0a0a",
          dark: "#111111",
          green: "#39ff14",
          cyan: "#00fff7",
          pink: "#ff2d95",
          yellow: "#ffe600",
          orange: "#ff6600",
          purple: "#b026ff",
        },
      },
      fontFamily: {
        display: ['"Press Start 2P"', "monospace"],
        body: ['"VT323"', "monospace"],
      },
      animation: {
        blink: "blink 1s step-end infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "float-up": "float-up 3s ease-out forwards",
        scanline: "scanline 8s linear infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.3)" },
        },
        "float-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
