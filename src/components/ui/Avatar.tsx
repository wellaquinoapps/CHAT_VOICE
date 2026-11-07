import React from 'react';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?: string;
  src?: string | null;
  online?: boolean;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

const dotSizeClasses: Record<AvatarSize, string> = {
  sm: 'h-2 w-2 bottom-0 right-0',
  md: 'h-2.5 w-2.5 bottom-0 right-0',
  lg: 'h-3 w-3 bottom-0.5 right-0.5',
  xl: 'h-4 w-4 bottom-1 right-1',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

function getColor(name?: string): string {
  const colors = [
    'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500',
    'bg-teal-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500',
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  online,
  size = 'md',
  className = '',
}) => {
  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name ?? 'avatar'}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} ${getColor(name)} rounded-full flex items-center justify-center text-white font-semibold`}
        >
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute ${dotSizeClasses[size]} rounded-full border-2 border-white ${
            online ? 'bg-green-400' : 'bg-gray-300'
          }`}
        />
      )}
    </div>
  );
};

