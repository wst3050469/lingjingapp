import { ReactNode, useState, useEffect } from 'react';
import { DESIGN_TOKENS } from './styles';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  onClick,
  className = '',
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm',
    secondary: 'bg-white/10 text-cp-text hover:bg-white/20 active:bg-white/30 border border-white/10',
    ghost: 'text-white/70 hover:text-white hover:bg-white/5',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: boolean;
}

export function Card({ children, className = '', hover = false, padding = true }: CardProps) {
  return (
    <div
      className={`
        bg-white/[0.03] 
        border border-white/10 
        backdrop-blur-sm 
        rounded-xl 
        ${padding ? 'p-6' : ''} 
        ${hover ? 'hover:bg-white/[0.05] hover:border-white/20 transition-all' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface InputProps {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  className = '',
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`
        w-full
        px-4 
        py-2.5
        bg-white/5 
        border border-white/10 
        rounded-lg
        text-cp-text 
        placeholder-white/40
        focus:border-primary-500 
        focus:ring-2 
        focus:ring-primary-500/20 
        focus:outline-none
        disabled:opacity-50 
        disabled:cursor-not-allowed
        transition-all
        ${className}
      `}
    />
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const variantStyles = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    neutral: 'bg-white/10 text-white/70 border-white/20',
  };

  return (
    <span
      className={`
        inline-flex 
        items-center 
        px-2.5 
        py-0.5 
        rounded-full 
        text-xs 
        font-medium 
        border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white/10 rounded ${className}`} />
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-6xl mb-4 opacity-50">{icon}</div>
      <h3 className="text-lg font-medium text-white/90 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-white/50 max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>
      {action}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export function StatCard({ label, value, icon, trend, trendValue }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/50 mb-1">{label}</p>
          <p className="text-2xl font-bold text-cp-text">{value}</p>
          {trend && trendValue && (
            <p className={`text-xs mt-2 flex items-center gap-1 ${
              trend === 'up' ? 'text-green-400' :
              trend === 'down' ? 'text-red-400' :
              'text-white/50'
            }`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-4xl opacity-20">{icon}</div>
        )}
      </div>
    </Card>
  );
}

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, className = '' }: ProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className={`h-2 bg-white/5 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizeStyles = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`animate-spin rounded-full border-2 border-white/20 border-t-primary-500 ${sizeStyles[size]}`}
      />
    </div>
  );
}
