import type { Config } from "tailwindcss";

/**
 * Optia design system — "Signal" theme.
 * Colors are driven by CSS variables (RGB triplets) defined in src/styles/globals.css,
 * so every token is theme-aware (light default, .dark variant) and supports Tailwind
 * opacity modifiers (e.g. bg-brand/20).
 */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        // --- Signal semantic tokens ---
        canvas: v("--canvas"),
        surface: {
          DEFAULT: v("--surface"),
          2: v("--surface-2"),
          3: v("--surface-3"),
        },
        border: {
          DEFAULT: v("--border"),
          strong: v("--border-strong"),
        },
        ink: v("--ink"),
        muted: v("--muted"),
        faint: v("--faint"),
        brand: {
          DEFAULT: v("--brand"),
          hover: v("--brand-hover"),
          fg: v("--brand-fg"),
          tint: v("--brand-tint"),
        },
        accent: {
          DEFAULT: v("--accent"),
          tint: v("--accent-tint"),
          // legacy alias used across the codebase
          blue: v("--brand"),
        },
        good: { DEFAULT: v("--good"), tint: v("--good-tint") },
        warn: { DEFAULT: v("--warn"), tint: v("--warn-tint") },
        poor: { DEFAULT: v("--poor"), tint: v("--poor-tint") },

        // --- Backward-compatible aliases (old token names -> new themed values) ---
        bg: {
          900: v("--canvas"),
          700: v("--surface"),
          500: v("--surface-2"),
          300: v("--border-strong"),
        },
        text: {
          primary: v("--ink"),
          secondary: v("--muted"),
        },
        green: { DEFAULT: v("--good") },
        red: { DEFAULT: v("--poor"), light: v("--poor") },
        yellow: { DEFAULT: v("--warn"), light: v("--warn-tint") },
      },
      fontFamily: {
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
      },
      fontSize: {
        display: ["40px", { lineHeight: "104%", fontWeight: "700", letterSpacing: "-0.02em" }],
        h1: ["24px", { lineHeight: "112%", fontWeight: "600", letterSpacing: "-0.015em" }],
        h2: ["18px", { lineHeight: "120%", fontWeight: "600", letterSpacing: "-0.01em" }],
        body: ["15px", { lineHeight: "150%", fontWeight: "400" }],
        "body-semibold": ["15px", { lineHeight: "150%", fontWeight: "600" }],
        "body-16": ["15px", { lineHeight: "150%", fontWeight: "400" }],
        "body-12": ["12px", { lineHeight: "140%", fontWeight: "400" }],
        button: ["14px", { lineHeight: "20px", fontWeight: "600" }],
        label: ["11px", { lineHeight: "120%", fontWeight: "600", letterSpacing: "0.06em" }],
        caption: ["12px", { lineHeight: "140%", fontWeight: "500" }],
      },
      borderRadius: {
        input: "10px",
        card: "14px",
        "card-lg": "18px",
        score: "24px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)",
        pop: "0 4px 12px rgb(15 23 42 / 0.08), 0 2px 4px rgb(15 23 42 / 0.04)",
        brand: "0 6px 18px -4px rgb(var(--brand) / 0.45)",
        "focus-ring": "0 0 0 3px rgb(var(--brand) / 0.35)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "scale-in": "scale-in 0.22s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
