import { CSSProperties } from 'react';
import { RoleChip, RoleChipColor, RoleChipColorEnd } from './style.css';
import { varName } from '../../utils/accent';

// Class and colours for a chip wearing a role's colour (and its second colour, if any).
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

// A name in its role's colour; two-colour roles paint it as a left-to-right gradient.
export const roleNameStyle = (color?: string, gradient?: string): CSSProperties =>
  color && gradient
    ? {
        backgroundImage: `linear-gradient(90deg, ${color}, ${gradient})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }
    : { color };
