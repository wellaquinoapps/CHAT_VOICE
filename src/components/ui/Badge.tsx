import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-indigo-100 text-indigo-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  outline: 'border border-gray-300 text-gray-600 bg-transparent',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
  >
    {children}
  </span>
);

