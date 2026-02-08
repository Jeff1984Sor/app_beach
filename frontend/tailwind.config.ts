import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F5F5F7",
        card: "#FFFFFF",
        primary: "#0A84FF",
        success: "#34C759",
        danger: "#FF3B30",
        text: "#1C1C1E",
        muted: "#8E8E93",
        border: "#E5E5EA"
      },
      borderRadius: {
        xl2: "1rem"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(28, 28, 30, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;

