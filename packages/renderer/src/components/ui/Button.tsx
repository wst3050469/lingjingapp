import React from 'react';
import { ButtonProps } from './types';
import { clsx } from 'clsx';

const variantStyles = {
  primary: 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white',
  secondary: 'bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-white',
  outline: 'border border-neutral-600 hover:bg-neutral-800 text-neutral-200',
  ghost: 'hover:bg-neutral-800 text-neutral-200',
  danger: 'bg-error-dark hover:bg-opacity-90 active:bg-opacity-80 text-white',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

const disabledStyles = 'opacity-50 cursor-not-allowed pointer-events-none';

const loadingStyles = 'cursor-wait';

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  children,
  onClick,
  className,
  ...ariaProps
}) => {
  const isDisabled = disabled || loading;

  const buttonClasses = clsx(
    'inline-flex items-center justify-center gap-2',
    'font-medium rounded-md',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900',
    variantStyles[variant],
    sizeStyles[size],
    isDisabled && disabledStyles,
    loading && loadingStyles,
    fullWidth && 'w-full',
    className
  );

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled && onClick) {
      onClick(e);
    }
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={handleClick}
      className={buttonClasses}
      aria-busy={loading}
      aria-disabled={isDisabled}
      {...ariaProps}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};

Button.displayName = 'Button';
