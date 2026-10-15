/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Editorial display serif (warm, optical) + clean UI sans. Loaded in
        // _document.js. Setting these here upgrades the whole app's type at once:
        // every `font-serif` heading becomes Fraunces, default text becomes Inter.
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: ["Fraunces", "ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
      },
      colors: {
        // Warm paper neutrals — the appetizing, editorial base (replaces cold grays)
        paper: {
          DEFAULT: "#fbf8f3",
          50: "#fdfcfa",
          100: "#faf6ef",
          200: "#f3ece0",
        },
        // Restaurant mode — bold orange/amber
        brand: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        // Diner mode — teal/emerald
        diner: {
          50:  "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        // Consumer mode — vibrant violet/purple
        consumer: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
      },
      boxShadow: {
        // Warm-tinted, soft elevation (not the default cold black shadows)
        soft: "0 2px 24px -6px rgba(90, 60, 30, 0.10), 0 2px 6px -2px rgba(90, 60, 30, 0.05)",
        lift: "0 18px 50px -12px rgba(90, 60, 30, 0.18), 0 6px 16px -8px rgba(90, 60, 30, 0.10)",
        glow: "0 10px 40px -8px rgba(234, 88, 12, 0.35)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.8s ease both",
      },
    },
  },
  plugins: [],
};
