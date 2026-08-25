import React from 'react';

/**
 * Reusable accessible Button component conforming to high-contrast guidelines.
 */
export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'accent' | 'outline'
  disabled = false,
  className = '',
  ariaLabel,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded px-6 py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gov-ashoka disabled:opacity-50 disabled:cursor-not-allowed text-base cursor-pointer min-h-[44px] min-w-[44px]';

  const variants = {
    primary: 'bg-gov-navy hover:bg-gov-navy-light text-white border-2 border-transparent',
    secondary: 'bg-gov-green hover:bg-gov-green-light text-white border-2 border-transparent',
    accent: 'bg-gov-saffron hover:bg-gov-saffron-light text-white border-2 border-transparent',
    outline: 'bg-transparent hover:bg-slate-100 text-gov-navy border-2 border-gov-navy',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${className}`}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  );
}
