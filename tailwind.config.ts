import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ['class', '[data-theme="midnight"]'],
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "var(--background)",
          subtle: "var(--background-subtle)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          glass: "var(--surface-glass)",
          hover: "var(--surface-hover)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          glass: "var(--border-glass)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          foreground: "var(--accent-foreground)",
        },
        status: {
          success: "var(--success)",
          warning: "var(--warning)",
          error: "var(--error)",
          info: "var(--info)",
        },
        focus: "var(--focus-ring)",
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        }
      },
      boxShadow: {
        'glass': 'var(--glass-shadow)',
        'glass-hover': '0 8px 32px rgba(0, 0, 0, 0.15)',
        'glass-elevated': '0 12px 40px rgba(0, 0, 0, 0.2)',
      },
      ringColor: {
        DEFAULT: "var(--focus-ring)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      }
    },
  },
  plugins: [],
};
export default config;
