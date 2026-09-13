'use client';

interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className, size = 32 }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Pot body */}
      <path
        d="M48 112 C48 112 40 168 40 192 C40 216 56 232 80 232 L176 232 C200 232 216 216 216 192 C216 168 208 112 208 112 Z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      {/* Pot rim */}
      <rect
        x="36"
        y="92"
        width="184"
        height="28"
        rx="14"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      {/* Handles */}
      <path
        d="M36 106 C20 106 16 80 36 80"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M220 106 C236 106 240 80 220 80"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      {/* Interlocking circles (coins) */}
      <circle cx="104" cy="160" r="20" stroke="currentColor" strokeWidth="10" fill="none" />
      <circle cx="152" cy="160" r="20" stroke="currentColor" strokeWidth="10" fill="none" />
      {/* Lid */}
      <ellipse
        cx="128"
        cy="76"
        rx="52"
        ry="18"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="10"
      />
      <circle cx="128" cy="60" r="10" fill="currentColor" />
    </svg>
  );
}
