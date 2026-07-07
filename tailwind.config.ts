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
        'glass-hover': 'var(--glass-shadow-hover)',
        'glass-elevated': 'var(--glass-shadow-elevated)',
        'glow-accent': '0 0 20px var(--accent-glow), 0 0 60px var(--accent-glow)',
        'glow-success': '0 0 16px var(--success-glow), 0 0 48px var(--success-glow)',
        'glow-error': '0 0 16px var(--error-glow), 0 0 48px var(--error-glow)',
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
