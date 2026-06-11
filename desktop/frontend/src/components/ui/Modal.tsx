import React, { useEffect, useCallback, useRef } from 'react';
import { ModalProps } from './types';
import { clsx } from 'clsx';

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  children,
  footer,
  className,
  overlayClassName,
  ...ariaProps
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  
  const handleClose = useCallback(() => {
    if (isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);
  
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (closeOnEsc && e.key === 'Escape') {
          handleClose();
        }
        
        if (e.key === 'Tab') {
          const modal = modalRef.current;
          if (!modal) return;
          
          const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
          
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      
      setTimeout(() => {
        const modal = modalRef.current;
        if (modal) {
          const firstFocusable = modal.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          firstFocusable?.focus();
        }
      }, 0);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, closeOnEsc, handleClose]);
  
  if (!isOpen) return null;
  
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      handleClose();
    }
  };
  
  return (
    <div
      className={clsx(
        'fixed inset-0 z-50',
        'flex items-center justify-center',
        'bg-black/60 backdrop-blur-sm',
        'animate-in fade-in duration-300 ease-out',
        overlayClassName
      )}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={clsx(
          'relative',
          'w-full',
          sizeStyles[size],
          'bg-gradient-to-b from-neutral-900 to-neutral-950',
          'rounded-xl shadow-2xl',
          'border border-neutral-800/50',
          'animate-in zoom-in-95 fade-in slide-in-from-bottom-4',
          'duration-300 ease-out',
          className
        )}
        role="dialog"
        aria-modal="true"
        {...ariaProps}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/50">
            {title && (
              <h2 
                className="text-lg font-semibold text-cp-text tracking-tight"
                id={ariaProps['aria-labelledby']}
              >
                {title}
              </h2>
            )}
            
            {showCloseButton && (
              <button
                onClick={handleClose}
                className={clsx(
                  'absolute top-4 right-4',
                  'p-1.5 rounded-lg',
                  'text-neutral-400 hover:text-white',
                  'hover:bg-neutral-800/50',
                  'active:scale-95',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500/50'
                )}
                aria-label="关闭对话框"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
        
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        
        {footer && (
          <div className="px-6 py-3 border-t border-neutral-800/50 bg-neutral-950/50 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

Modal.displayName = 'Modal';
