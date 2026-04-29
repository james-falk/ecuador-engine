import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Ecuador Engine palette — neutral workspace + accents tied to brands
        accent: {
          finca: "#C8102E", // dragon-fruit red (Finca brand)
          puresol: "#007A3D", // green (Finca/cold-chain accent, also reads as "fresh import")
        },
      },
    },
  },
  plugins: [],
};

export default config;
