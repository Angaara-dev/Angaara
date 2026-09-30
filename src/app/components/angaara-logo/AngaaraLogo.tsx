import React, { useId } from 'react';
import classNames from 'classnames';
import * as css from './AngaaraLogo.css';
import { BRAND_NAME } from '../../brand';

const SQUIRCLE =
  'M18 9L17.98 11.82L17.91 12.98L17.8 13.85L17.65 14.57L17.45 15.18L17.21 15.71L16.91 16.17L16.57 16.57L16.17 16.91L15.71 17.21L15.18 17.45L14.57 17.65L13.85 17.8L12.98 17.91L11.82 17.98L9 18L6.18 17.98L5.02 17.91L4.15 17.8L3.43 17.65L2.82 17.45L2.29 17.21L1.83 16.91L1.43 16.57L1.09 16.17L0.79 15.71L0.55 15.18L0.35 14.57L0.2 13.85L0.09 12.98L0.02 11.82L0 9L0.02 6.18L0.09 5.02L0.2 4.15L0.35 3.43L0.55 2.82L0.79 2.29L1.09 1.83L1.43 1.43L1.83 1.09L2.29 0.79L2.82 0.55L3.43 0.35L4.15 0.2L5.02 0.09L6.18 0.02L9 0L11.82 0.02L12.98 0.09L13.85 0.2L14.57 0.35L15.18 0.55L15.71 0.79L16.17 1.09L16.57 1.43L16.91 1.83L17.21 2.29L17.45 2.82L17.65 3.43L17.8 4.15L17.91 5.02L17.98 6.18Z';

type AngaaraLogoProps = {
  size: number;
  // Flickering flame and pulsing glow; off by default so small icons stay calm.
  animated?: boolean;
  className?: string;
};
export function AngaaraLogo({ size, animated, className }: AngaaraLogoProps) {
  const gradientId = useId();
  return (
    <svg
      className={classNames(css.Logo, animated && css.Animated, className)}
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      role="img"
      aria-label={BRAND_NAME}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="2"
          y1="1"
          x2="16"
          y2="17"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FF9A5C" />
          <stop offset="1" stopColor="#F0441E" />
        </linearGradient>
      </defs>
      <path d={SQUIRCLE} fill={`url(#${gradientId})`} />
      <g className={css.Flame}>
        <path
          d="M9 3.2C9.9 5 12.6 6.4 12.6 9.9C12.6 12.1 11 13.9 9 13.9C7 13.9 5.4 12.1 5.4 9.9C5.4 8.3 6.3 7.3 7 6.6C7 7.9 7.6 8.7 8.4 9C8.2 7 8.6 4.9 9 3.2Z"
          fill="#FFFFFF"
        />
        <path
          d="M9 10C9.6 10.8 10.4 11.3 10.4 12.2C10.4 13 9.8 13.6 9 13.6C8.2 13.6 7.6 13 7.6 12.2C7.6 11.4 8.4 10.8 9 10Z"
          fill="#FF7A45"
        />
      </g>
    </svg>
  );
}
