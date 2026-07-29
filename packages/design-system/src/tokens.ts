export const colors = {
  midnight: "#0D1B2A",
  petroleum: "#173B4A",
  orange: "#FF8A00",
  orangeBright: "#FFB000",
  white: "#F8F9FB",
  graphite: "#2B2F36",
  steel: "#6C7A89",
  silver: "#DDE4EA",
  light: "#EEF2F5",
  success: "#00C853",
  warning: "#FFB300",
  danger: "#D32F2F",
  info: "#0091EA"
} as const;

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  32: "8rem"
} as const;

export const radius = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  pill: "999px"
} as const;

export const shadow = {
  sm: "0 4px 12px rgb(0 0 0 / 0.08)",
  md: "0 10px 30px rgb(0 0 0 / 0.12)",
  lg: "0 25px 60px rgb(0 0 0 / 0.18)",
  glow: "0 0 40px rgb(255 138 0 / 0.25)"
} as const;

export const motion = {
  fast: "150ms",
  normal: "250ms",
  slow: "400ms",
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
} as const;

export const typography = {
  fontSans: "var(--font-manrope), system-ui, sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace"
} as const;

export const breakpoints = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem"
} as const;
