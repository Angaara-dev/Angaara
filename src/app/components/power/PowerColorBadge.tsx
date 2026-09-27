import React from 'react';
import { as } from 'folds';
import classNames from 'classnames';
import * as css from './style.css';

type PowerColorBadgeProps = {
  color?: string;
  // Second colour for two-colour roles.
  gradient?: string;
};
export const PowerColorBadge = as<'span', PowerColorBadgeProps>(
  ({ as: AsPowerColorBadge = 'span', color, gradient, className, style, ...props }, ref) => (
    <AsPowerColorBadge
      className={classNames(css.PowerColorBadge, { [css.PowerColorBadgeNone]: !color }, className)}
      style={{
        backgroundColor: color,
        backgroundImage:
          color && gradient ? `linear-gradient(135deg, ${color}, ${gradient})` : undefined,
        ...style,
      }}
      {...props}
      ref={ref}
    />
  )
);
