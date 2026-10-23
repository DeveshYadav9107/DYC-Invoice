import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd1ff',
          300: '#8eb3ff',
          400: '#5988ff',
          500: '#3363ff',
          600: '#1b3ff5',
          700: '#142ce1',
          800: '#1725b6',
          900: '#19258f',
          950: '#0f1557',
        },
        navy: {
          50: '#f0f3f9',
          100: '#dae1f0',
          200: '#bcc9e4',
          300: '#90a7d2',
          400: '#6280bb',
          500: '#4563a5',
          600: '#364e8b',
          700: '#2e4071',
          800: '#29385f',
          900: '#1e2a47',
          950: '#0f1729',
        },
        success: {
          50: '#edfcf2',
          100: '#d3f8e0',
          200: '#aaefc6',
          300: '#73e1a5',
          400: '#3acb7f',
          500: '#17b064',
          600: '#0b8e50',
          700: '#097142',
          800: '#0a5936',
          900: '#09492e',
          950: '#04291a',
        },
        warning: {
          50: '#fffbeb',
          100: '#fff3c6',
          200: '#ffe588',
          300: '#ffd24a',
          400: '#ffbe20',
          500: '#f99d07',
          600: '#dd7602',
          700: '#b75206',
          800: '#943f0c',
          900: '#7a340d',
          950: '#461a02',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        card: '0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
        elevated: '0 10px 40px -10px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [forms],
};
