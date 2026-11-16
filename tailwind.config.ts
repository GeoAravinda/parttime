import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563eb', foreground: '#ffffff', 50: '#eff6ff', 100: '#dbeafe', 600: '#2563eb', 700: '#1d4ed8' },
      },
      fontFamily: { sans: ['Inter', '"Noto Sans JP"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
