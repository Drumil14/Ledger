/**
 * Ledger design tokens — the single source of visual truth.
 *
 * Derived directly from the brand moodboard: a strictly monochrome system of
 * black, warm white, and greys. No colour, no gradients. Hierarchy is created
 * with typography (Inter), weight, opacity, whitespace and dividers — never
 * with coloured boxes.
 */

import { StyleSheet } from 'react-native';

/* -------------------------------------------------------------------------- */
/* Colour                                                                     */
/* -------------------------------------------------------------------------- */

export const colors = {
  /** Headings, primary text, icons, key elements. */
  primary: '#111111',
  /** App background. */
  background: '#FAFAF8',
  /** Cards / raised surfaces. */
  surface: '#FFFFFF',
  /** Secondary dark (pressed primary, subtle dark fills). */
  secondaryDark: '#2A2A29',
  /** Secondary text, metadata, placeholders. */
  textSecondary: '#6B6B66',
  /** Disabled text and controls. */
  disabled: '#A5A5A0',
  /** Hairline dividers and borders. */
  divider: '#D9D8D3',
  /** Alternative / inset surface. */
  surfaceAlt: '#F2F1ED',

  /** On-dark text (labels inside the primary black button). */
  onPrimary: '#FAFAF8',
  /** Full black, reserved for pure ink moments. */
  ink: '#000000',
} as const;

export type ColorToken = keyof typeof colors;

/* -------------------------------------------------------------------------- */
/* Typography                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Inter, loaded via `@expo-google-fonts/inter`. Weight lives in the family name
 * on Android, so we always set an explicit family rather than `fontWeight`.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type FontFamilyToken = keyof typeof fontFamily;

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

/**
 * Named text roles. Sizes follow the moodboard's type spec. Large monetary
 * figures opt into tabular numerals at the component level (see MoneyText).
 */
export const typography = {
  /** App logo / wordmark. */
  logo: { fontFamily: fontFamily.bold, fontSize: 52, lineHeight: 56, letterSpacing: -1.5 },
  /** Large financial numbers ("$1,842.26"). */
  display: { fontFamily: fontFamily.semibold, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  /** Page title. */
  pageTitle: { fontFamily: fontFamily.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  /** Section title. */
  sectionTitle: { fontFamily: fontFamily.medium, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  /** Transaction / row title. */
  rowTitle: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  /** Inline amounts. */
  amount: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  /** Body copy. */
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  /** Button labels. */
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20, letterSpacing: -0.1 },
  /** Metadata, timestamps, secondary detail. */
  metadata: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  /** Small uppercase eyebrow / tagline (wide tracking). */
  eyebrow: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 2.4 },
} as const satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;

/* -------------------------------------------------------------------------- */
/* Spacing / radius / motion                                                  */
/* -------------------------------------------------------------------------- */

/** 4pt spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Corner radii — max 12 per the brand rules. */
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 999,
} as const;

/** Motion durations (ms). Kept in the 150–400ms range — restrained, no bounce. */
export const duration = {
  instant: 120,
  fast: 180,
  base: 240,
  slow: 320,
  xslow: 420,
} as const;

/** Hairline that stays crisp across densities. */
export const hairline = StyleSheet.hairlineWidth;

export const theme = {
  colors,
  fontFamily,
  typography,
  spacing,
  radius,
  duration,
  hairline,
} as const;

export type Theme = typeof theme;
