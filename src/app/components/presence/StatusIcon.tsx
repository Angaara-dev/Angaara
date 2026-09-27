import React, { useId } from 'react';
import { ActivityStatus, ACTIVITY_LABELS } from '../../hooks/useActivityStatus';

export const ACTIVITY_COLORS: Record<ActivityStatus, string> = {
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
};

// Status shapes: dot, moon, minus and hollow ring.
type StatusIconProps = {
  status: ActivityStatus;
  size?: number;
  // Set when the status is already written next to the icon.
  decorative?: boolean;
};
export function StatusIcon({ status, size = 10, decorative }: StatusIconProps) {
  const maskId = useId();
  const fill = ACTIVITY_COLORS[status];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : ACTIVITY_LABELS[status]}
      aria-hidden={decorative || undefined}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {!decorative && <title>{ACTIVITY_LABELS[status]}</title>}
      <mask id={maskId}>
        <rect width="10" height="10" fill="white" />
        {status === 'idle' && <circle cx="2.5" cy="2.5" r="3.75" fill="black" />}
        {status === 'dnd' && <rect x="2" y="4" width="6" height="2" rx="1" fill="black" />}
        {status === 'offline' && <circle cx="5" cy="5" r="2.5" fill="black" />}
      </mask>
      <circle cx="5" cy="5" r="5" fill={fill} mask={`url(#${maskId})`} />
    </svg>
  );
}
