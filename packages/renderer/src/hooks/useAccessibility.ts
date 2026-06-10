import { useEffect, useRef, useCallback } from 'react';

interface FocusTrapOptions {
  enabled?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  options: FocusTrapOptions = {}
) {
  const { enabled = true, autoFocus = true, restoreFocus = true } = options;
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    
    if (restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
    
    const container = containerRef.current;
    
    const getFocusableElements = () => {
      return container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
      );
    };
    
    if (autoFocus) {
      requestAnimationFrame(() => {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      });
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    };
  }, [enabled, autoFocus, restoreFocus]);
  
  return containerRef;
}

interface AnnounceOptions {
  assertive?: boolean;
}

let liveRegionPolite: HTMLElement | null = null;
let liveRegionAssertive: HTMLElement | null = null;

function ensureLiveRegions() {
  if (!liveRegionPolite) {
    liveRegionPolite = document.createElement('div');
    liveRegionPolite.setAttribute('aria-live', 'polite');
    liveRegionPolite.setAttribute('aria-atomic', 'true');
    liveRegionPolite.setAttribute('role', 'status');
    Object.assign(liveRegionPolite.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    document.body.appendChild(liveRegionPolite);
  }
  
  if (!liveRegionAssertive) {
    liveRegionAssertive = document.createElement('div');
    liveRegionAssertive.setAttribute('aria-live', 'assertive');
    liveRegionAssertive.setAttribute('aria-atomic', 'true');
    liveRegionAssertive.setAttribute('role', 'alert');
    Object.assign(liveRegionAssertive.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    document.body.appendChild(liveRegionAssertive);
  }
}

export function announce(message: string, options: AnnounceOptions = {}) {
  const { assertive = false } = options;
  ensureLiveRegions();
  
  const region = assertive ? liveRegionAssertive! : liveRegionPolite!;
  region.textContent = '';
  
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

export function useKeyboardNavigation<T extends HTMLElement = HTMLElement>() {
  const containerRef = useRef<T>(null);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    const focusableItems = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[role="option"], [role="menuitem"], [role="tab"], [role="treeitem"], button:not([disabled]), a[href]'
      )
    );
    
    const currentIndex = focusableItems.indexOf(document.activeElement as HTMLElement);
    
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : 0;
        focusableItems[nextIndex]?.focus();
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableItems.length - 1;
        focusableItems[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        focusableItems[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        focusableItems[focusableItems.length - 1]?.focus();
        break;
      }
    }
  }, []);
  
  return { containerRef, handleKeyDown };
}
