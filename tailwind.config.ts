import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "primary": "#ec135b",
        "background-light": "#f8f6f6",
        "background-dark": "#221016",
        "surface-dark": "#331922",
        "surface-border": "#673244",
        "text-muted": "#c992a4",
        "surface-light": "#ffffff",
      },
      fontFamily: {
        "display": ["var(--font-jakarta)", "sans-serif"]
      },
      borderRadius: {
          "DEFAULT": "0.5rem",
          "lg": "0.5rem",
          "xl": "0.75rem",
          "full": "9999px"
      },
    },
  },
  plugins: [],
};
export default config;
