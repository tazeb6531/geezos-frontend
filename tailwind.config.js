/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#F0A500',
          light: '#F5C842',
          dark: '#C47E00',
        },
        navy: {
          DEFAULT: '#1A1A2E',
          light: '#16213E',
          mid: '#0F3460',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseGold: { '0%,100%': { boxShadow: '0 0 0 0 rgba(240,165,0,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(240,165,0,0)' } },
      },
    },
  },
  plugins: [],
}
