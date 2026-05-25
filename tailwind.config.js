/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper:         { DEFAULT: 'rgb(var(--paper) / <alpha-value>)' },
        ink:           { DEFAULT: 'rgb(var(--ink) / <alpha-value>)' },
        'ink-mid':     'rgb(var(--ink-mid) / <alpha-value>)',
        'ink-soft':    'rgb(var(--ink-soft) / <alpha-value>)',
        'ink-muted':   'rgb(var(--ink-muted) / <alpha-value>)',
        rule:          'rgb(var(--rule) / <alpha-value>)',
        'rule-soft':   'rgb(var(--rule-soft) / <alpha-value>)',
        accent:        'rgb(var(--accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'card-active': 'rgb(var(--card-active) / <alpha-value>)',
        'btn-bg':      'rgb(var(--btn-bg) / <alpha-value>)',
        'btn-text':    'rgb(var(--btn-text) / <alpha-value>)',
        tape:          'rgb(var(--tape) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['Spectral', 'Iowan Old Style', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'card-active': '3px 3px 0 rgb(var(--ink))',
        page:          '0 1px 0 rgba(40,30,10,0.05), 0 10px 24px rgba(80,55,20,0.12), 0 30px 60px rgba(80,55,20,0.08)',
        'page-dark':   '0 1px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.4), 0 30px 60px rgba(0,0,0,0.3)',
        'btn-stamp':   '3px 3px 0 rgb(var(--accent))',
      },
    },
  },
  plugins: [],
}
