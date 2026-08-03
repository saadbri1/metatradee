import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // shadcn/ui semantic tokens (theme-aware via CSS vars)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Navigation rail — its own scale so it never inverts with the theme.
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          'muted-foreground': 'hsl(var(--sidebar-muted-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          border: 'hsl(var(--sidebar-border))',
        },
        // Modal scrim — always black, never derived from foreground.
        overlay: 'hsl(var(--overlay))',
        // The elevated surface step, named rather than borrowed from popover.
        'surface-raised': 'hsl(var(--surface-raised))',
        // MetaTradee brand + reserved trading semantics
        iris: 'hsl(var(--iris))',
        profit: 'hsl(var(--profit))',
        loss: 'hsl(var(--loss))',
        warning: 'hsl(var(--warning))',
        /*
         * Success is its own token, NOT an alias of profit. Profit is reserved
         * for P&L and must never decorate, which previously left confirmations
         * with no colour at all.
         */
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
      },
      /*
       * Layout rhythm. Named beats for the workspace so gutters, panel padding
       * and stack gaps stop being picked per component.
       */
      spacing: {
        gutter: 'var(--space-gutter)',
        panel: 'var(--space-panel)',
        stack: 'var(--space-stack)',
      },
      /*
       * Type scale for the authenticated app. These replace the arbitrary
       * pixel sizes (text-[15px], text-[13px], text-[11px]) that were scattered
       * across the shell and dashboard, where a panel title was 15px in one
       * component and text-base in another.
       */
      fontSize: {
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        meta: ['0.75rem', { lineHeight: '1.125rem' }],
        control: ['0.8125rem', { lineHeight: '1.25rem' }],
        'panel-title': ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em' }],
        'page-title': ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.02em' }],
        metric: ['1.5rem', { lineHeight: '1.875rem', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        raised: 'var(--shadow-raised)',
        rail: 'var(--shadow-rail)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 6px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      /**
       * Semantic motion tokens (Phase 12.2). Additive extension only — the
       * existing scales are untouched. Components consume these names instead
       * of inventing per-component millisecond values. The canonical numeric
       * source is `src/features/workspace/motion.ts`, which JS-driven motion
       * (Framer) reads so CSS and JS stay in lockstep.
       */
      transitionDuration: {
        instant: '0ms',
        fast: '120ms',
        normal: '220ms',
        deliberate: '320ms',
      },
      transitionTimingFunction: {
        // Standard: decelerate into place. Emphasized: more expressive entrance.
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        emphasized: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.16s ease-out',
        'accordion-up': 'accordion-up 0.16s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
