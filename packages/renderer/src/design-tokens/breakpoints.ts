export const breakpoints = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointName = keyof typeof breakpoints;

export function getBreakpoint(width: number): BreakpointName {
  if (width < breakpoints.xs) return 'xs';
  if (width < breakpoints.sm) return 'sm';
  if (width < breakpoints.md) return 'md';
  if (width < breakpoints.lg) return 'lg';
  if (width < breakpoints.xl) return 'xl';
  return '2xl';
}

export function isBreakpointAbove(width: number, bp: BreakpointName): boolean {
  return width >= breakpoints[bp];
}

export function isBreakpointBelow(width: number, bp: BreakpointName): boolean {
  return width < breakpoints[bp];
}

export const sidebarWidths = {
  xs: { min: 0, default: 0, max: 0 },
  sm: { min: 0, default: 0, max: 0 },
  md: { min: 170, default: 220, max: 400 },
  lg: { min: 170, default: 260, max: 500 },
  xl: { min: 200, default: 280, max: 600 },
  '2xl': { min: 200, default: 300, max: 700 },
} as const;

export const panelHeights = {
  bottom: { min: 150, default: 250, max: 500 },
  chat: { min: 300, default: 400, max: 800 },
} as const;
