import { useState, useEffect, useCallback } from 'react';
import { breakpoints, BreakpointName, getBreakpoint } from '../design-tokens/breakpoints';

interface ViewportInfo {
  width: number;
  height: number;
  breakpoint: BreakpointName;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  isSmallScreen: boolean;
}

function getViewportInfo(width: number, height: number): ViewportInfo {
  const bp = getBreakpoint(width);
  
  return {
    width,
    height,
    breakpoint: bp,
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    isLargeDesktop: width >= breakpoints.xl,
    isSmallScreen: width < breakpoints.sm,
  };
}

export function useViewport(): ViewportInfo {
  const [viewport, setViewport] = useState<ViewportInfo>(
    getViewportInfo(window.innerWidth, window.innerHeight)
  );
  
  useEffect(() => {
    let rafId: number;
    
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setViewport(getViewportInfo(window.innerWidth, window.innerHeight));
      });
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);
  
  return viewport;
}

export function useBreakpoint(): BreakpointName {
  return useViewport().breakpoint;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    return window.matchMedia(query).matches;
  });
  
  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    setMatches(mediaQuery.matches);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);
  
  return matches;
}

export function useIsMobile(): boolean {
  return useViewport().isMobile;
}

export function useIsDesktop(): boolean {
  return useViewport().isDesktop;
}
