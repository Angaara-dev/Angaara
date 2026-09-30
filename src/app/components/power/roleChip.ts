import { CSSProperties } from 'react';
import { RoleChip, RoleChipColor, RoleChipColorEnd } from './style.css';
import { varName } from '../../utils/accent';

export const roleChipProps = (
  color: string | undefined,
  gradient?: string
): { className?: string; style?: CSSProperties } => {
  const start = varName(RoleChipColor);
  const end = varName(RoleChipColorEnd);
  if (!color || !start || !end) return {};
  return {
    className: RoleChip,
    style: { [start]: color, ...(gradient && { [end]: gradient }) } as CSSProperties,
  };
};

export const roleNameStyle = (color?: string, gradient?: string): CSSProperties =>
  color && gradient
    ? {
        backgroundImage: `linear-gradient(90deg, ${color}, ${gradient})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }
    : { color };
