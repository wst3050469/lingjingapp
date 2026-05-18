import React from 'react';
import { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps } from './types';
import { clsx } from 'clsx';

const variantStyles = {
  default: 'bg-neutral-800',
  outlined: 'bg-neutral-900 border border-neutral-700',
  elevated: 'bg-neutral-900 shadow-lg',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Body: React.FC<CardBodyProps>;
  Footer: React.FC<CardFooterProps>;
} = ({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  clickable = false,
  children,
  onClick,
  className,
}) => {
  const cardClasses = clsx(
    'rounded-lg',
    variantStyles[variant],
    paddingStyles[padding],
    hoverable && 'transition-all duration-200 hover:shadow-md hover:scale-[1.02]',
    clickable && 'cursor-pointer transition-colors duration-200 hover:bg-neutral-700',
    onClick && 'cursor-pointer',
    className
  );
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };
  
  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};

Card.Header = ({ title, subtitle, action, className }: CardHeaderProps) => (
  <div className={clsx('flex items-start justify-between mb-3', className)}>
    <div>
      <h3 className="text-lg font-semibold text-neutral-100">{title}</h3>
      {subtitle && (
        <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>
      )}
    </div>
    {action && <div>{action}</div>}
  </div>
);

Card.Body = ({ children, className }: CardBodyProps) => (
  <div className={clsx('text-neutral-200', className)}>{children}</div>
);

Card.Footer = ({ children, className }: CardFooterProps) => (
  <div className={clsx('mt-4 pt-4 border-t border-neutral-700', className)}>
    {children}
  </div>
);

Card.Header.displayName = 'Card.Header';
Card.Body.displayName = 'Card.Body';
Card.Footer.displayName = 'Card.Footer';
Card.displayName = 'Card';
