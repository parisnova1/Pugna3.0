import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0B0C0E",
        panel: "#14161A",
        ink: "#F4F1EC",
        mute: "#8A8580",
        signal: "#DC3A2C",
        onsignal: "#0B0C0E",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
      },
      backdropBlur: {
        glass: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
