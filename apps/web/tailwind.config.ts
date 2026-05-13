import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui"],
        serif: ["var(--font-playfair)", "Georgia"],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        card: "var(--card)",
        border: "var(--border)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        graph: "var(--graph)",
        pos: "var(--pos)",
        neg: "var(--neg)",
      },
    },
  },
  plugins: [],
};

export default config;
