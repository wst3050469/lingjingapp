import React, { forwardRef, useId } from 'react';
import { InputProps } from './types';
import { clsx } from 'clsx';

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-5 py-3 text-lg',
};

const variantStyles = {
  default: 'bg-neutral-800 border-neutral-700',
  filled: 'bg-neutral-900 border-transparent',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  type = 'text',
  size = 'md',
  variant = 'default',
  label,
  placeholder,
  value,
  defaultValue,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = true,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  className,
  id: providedId,
  name,
  autoComplete,
  ...ariaProps
}, ref) => {
  const generatedId = useId();
  const inputId = providedId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  
  const hasError = Boolean(error);
  const hasHelper = Boolean(helperText);
  
  const inputWrapperClasses = clsx(
    'relative flex items-center',
    fullWidth && 'w-full'
  );
  
  const inputClasses = clsx(
    'w-full',
    'rounded-md border',
    'text-neutral-100 placeholder-neutral-500',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
    variantStyles[variant],
    sizeStyles[size],
    hasError && 'border-error-dark focus:ring-error-dark',
    disabled && 'opacity-50 cursor-not-allowed bg-neutral-900',
    readOnly && 'cursor-default',
    leftIcon && 'pl-10',
    rightIcon && 'pr-10',
    className
  );
  
  const ariaDescribedBy = 
    (hasError ? errorId : '') || 
    (hasHelper ? helperId : '') || 
    ariaProps['aria-describedby'];
  
  return (
    <div className={clsx('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label 
          htmlFor={inputId}
          className={clsx(
            'text-sm font-medium text-neutral-200',
            required && "after:content-['*'] after:ml-0.5 after:text-error-dark"
          )}
        >
          {label}
        </label>
      )}
      
      <div className={inputWrapperClasses}>
        {leftIcon && (
          <span className="absolute left-3 text-neutral-500 pointer-events-none">
            {leftIcon}
          </span>
        )}
        
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          autoComplete={autoComplete}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className={inputClasses}
          aria-invalid={hasError}
          aria-describedby={ariaDescribedBy}
          {...ariaProps}
        />
        
        {rightIcon && (
          <span className="absolute right-3 text-neutral-500 pointer-events-none">
            {rightIcon}
          </span>
        )}
      </div>
      
      {hasError && (
        <p 
          id={errorId}
          className="text-sm text-error-dark"
          role="alert"
        >
          {error}
        </p>
      )}
      
      {hasHelper && !hasError && (
        <p 
          id={helperId}
          className="text-sm text-neutral-500"
        >
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
