'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { forwardRef } from 'react';

type Variant = 'accent' | 'dark' | 'ghost';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  withArrow?: boolean;
  href?: string;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  accent: 'bg-accent hover:bg-accent-hover text-white',
  dark: 'bg-black hover:bg-surface text-white',
  ghost: 'bg-transparent hover:bg-surface border border-surface-2 text-text',
};

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ variant = 'accent', withArrow = false, href, children, className = '', ...props }, ref) => {
    const base =
      'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
    const variantCls = variantClasses[variant];

    const inner = (
      <>
        {children}
        {withArrow && (
          <span className="flex items-center justify-center rounded-full bg-white w-6 h-6">
            <ArrowRight size={14} className="text-black" />
          </span>
        )}
      </>
    );

    if (href) {
      return (
        <Link
          href={href}
          className={`${base} ${variantCls} ${className}`}
        >
          {inner}
        </Link>
      );
    }

    return (
      <button ref={ref} className={`${base} ${variantCls} ${className}`} {...props}>
        {inner}
      </button>
    );
  }
);

PillButton.displayName = 'PillButton';
