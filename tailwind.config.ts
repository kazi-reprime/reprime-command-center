import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        reprime: {
          blue: "var(--reprime-blue)",
          navy: "var(--reprime-navy)",
          lavender: "var(--reprime-lavender)",
          ice: "var(--reprime-ice)",
        }
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.05)',
        'glass-hover': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-elevated': '0 12px 40px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
};
export default config;
