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
      },
    },
  },
  plugins: [],
};

export default config;
