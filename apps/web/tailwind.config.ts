import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'oklch(96% 0.04 193)',
          100: 'oklch(90% 0.07 193)',
          200: 'oklch(82% 0.10 193)',
          300: 'oklch(72% 0.12 193)',
          400: 'oklch(62% 0.12 193)',
          500: 'oklch(55% 0.11 193)',
          600: 'oklch(46% 0.10 193)',
          700: 'oklch(37% 0.08 193)',
          800: 'oklch(28% 0.07 193)',
          900: 'oklch(20% 0.05 193)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
