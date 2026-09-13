/**
 * PotLuck design-system colour tokens.
 * Tailwind v4: tokens are defined as CSS custom properties in `@theme` inside
 * globals.css (--color-bg, --color-surface, etc.) and are usable as utility
 * classes: bg-bg, bg-surface, text-text, text-text-muted, bg-accent, etc.
 *
 * This file exports the raw hex values for use in non-Tailwind contexts
 * (e.g. canvas draws, inline styles, third-party chart libraries).
 */
export const theme = {
  colors: {
    bg: "#0E0B14",
    surface: "#1A1526",
    "surface-2": "#2B2644",
    accent: "#8B7FFF",
    "accent-hover": "#7A6EF0",
    text: "#F4F2FA",
    "text-muted": "#A79FC2",
  },
} as const;

export type ThemeColor = keyof typeof theme.colors;
