export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './node_modules/streamdown/dist/**/*.js'
  ],
  safelist: ['border', 'border-border'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      // Typography - Pixel-perfect monospace for terminal aesthetic
      fontFamily: {
        mono: ['"ArkPixel"', '"JetBrains Mono"', '"Roboto Mono"', '"Courier New"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Orbitron"', '"Rajdhani"', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.01em' }],  // 13px
        'sm': ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '0.01em' }],  // 15px
        'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],            // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],   // 18px
        'xl': ['1.375rem', { lineHeight: '1.875rem', letterSpacing: '-0.01em' }],  // 22px
        '2xl': ['1.625rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }], // 26px
        '3xl': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],       // 32px
        '4xl': ['2.5rem', { lineHeight: '3rem', letterSpacing: '-0.02em' }],       // 40px
      },
      // Extended Color System
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Core Palette - Direct color access
        terminal: {
          orange: '#FF6B2C',      // Vibrant Orange
          'orange-dark': '#E55A1F',
          red: '#D32F2F',         // Deep Red
          'red-dark': '#B71C1C',
          green: '#00E676',       // Signal Green
          'green-dark': '#00C853',
          grey: {
            50: '#F5F5F5',
            100: '#E0E0E0',
            200: '#BDBDBD',
            300: '#9E9E9E',
            400: '#757575',
            500: '#616161',
            600: '#424242',
            700: '#303030',
            800: '#212121',
            900: '#1A1A1A',
          }
        }
      },
      // Simplified Border Radius
      borderRadius: {
        lg: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'var(--radius)',
        none: '0',
      },
      // Refined Shadows - Subtle and clean
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': '0 4px 6px rgba(0, 0, 0, 0.12)',
        'focus': 'var(--shadow-focus)',
        // Minimal retro effect for special cases
        'terminal': '1px 1px 0px rgba(0, 0, 0, 0.15)',
        'terminal-md': '2px 2px 0px rgba(0, 0, 0, 0.15)',
        // Glow effects for status indicators
        'glow-orange': '0 0 8px rgba(255, 107, 44, 0.4)',
        'glow-red': '0 0 8px rgba(211, 47, 47, 0.4)',
        'glow-green': '0 0 8px rgba(0, 230, 118, 0.4)',
      },
      // Refined Animations
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // Subtle fade in
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Slide in from bottom
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // Subtle pulse for status indicators
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        // Terminal cursor blink
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        // Simplified scanline
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      // Spacing adjustments for pixel-perfect layouts
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
};