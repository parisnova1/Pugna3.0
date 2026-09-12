import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "var(--void)",
        panel: "var(--panel)",
        "panel-elevated": "var(--panel-elevated)",
        "panel-hover": "var(--panel-hover)",
        ink: "var(--ink)",
        mute: "var(--mute)",
        muted: "var(--muted)",
        disabled: "var(--disabled)",
        line: "var(--border)",
        "line-subtle": "var(--border-subtle)",
        "line-strong": "var(--border-strong)",
        signal: "var(--signal)",
        "signal-hover": "var(--signal-hover)",
        onsignal: "var(--onsignal)",
        live: "var(--live)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },
      backdropBlur: {
        glass: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
