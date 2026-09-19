/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "Segoe UI", "sans-serif"] },
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        line: "var(--line)",
        "line-2": "var(--line-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
      },
      // Squarish: keep every radius small and flat.
      borderRadius: {
        none: "0",
        DEFAULT: "4px",
        sm: "3px",
        md: "4px",
        lg: "6px",
        xl: "6px",
        "2xl": "8px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
