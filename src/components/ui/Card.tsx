import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div
    {...props}
    className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div {...props} className={`px-5 pt-5 pb-3 ${className}`}>
    {children}
  </div>
);

export const CardTitle: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <h3 {...props} className={`font-semibold text-gray-900 text-base ${className}`}>
    {children}
  </h3>
);

export const CardDescription: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <p {...props} className={`text-sm text-gray-500 mt-0.5 ${className}`}>
    {children}
  </p>
);

export const CardContent: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div {...props} className={`px-5 pb-5 ${className}`}>
    {children}
  </div>
);

