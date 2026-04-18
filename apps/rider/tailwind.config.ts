import type { Config } from 'tailwindcss';

/**
 * Teeko Rider — Tailwind theme
 *
 * Token naming matches the refined Stitch mockups
 * (docs/v0.1/plans/rider-mockup/stitch-hero-mockups.md).
 *
 * - `bg-surface` / `bg-muted` / `bg-raised`   — surface tones
 * - `text-ink-primary` / `-secondary` / `-faint`  — text tones
 * - `border-border`  — divider/border color
 * - `bg-primary`     — Teeko red (use sparingly)
 * - `rounded-lg`  = 16px card corner
 * - `rounded-xl`  = 24px softer card corner
 * - `rounded-full` = pill CTAs
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E11D2E',
          50: '#FEF2F2',
          100: '#FEE2E2',
          600: '#DC2626',
          700: '#B91C1C',
        },
        surface: '#FFFFFF',
        muted: '#F5F5F7',
        raised: '#FAFAFA',
        ink: {
          primary: '#111111',
          secondary: '#4B5563',
          faint: '#9CA3AF',
        },
        border: '#E5E7EB',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        headline: ['Nunito_700Bold', 'system-ui', 'sans-serif'],
        body: ['Nunito_400Regular', 'system-ui', 'sans-serif'],
        label: ['Nunito_600SemiBold', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
      spacing: {
        gutter: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
