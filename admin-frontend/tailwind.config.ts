import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './context/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        line: 'var(--color-line)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        brand: 'var(--color-brand)',
        accent: 'var(--color-accent)',
      },
      boxShadow: {
        velvet: '0 18px 48px -26px rgba(13, 19, 33, 0.35)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      borderRadius: {
        shell: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
