import React from 'react';
import { Box, Icon, Text, Tooltip, TooltipProvider, config, toRem } from 'folds';
import { useUserBadges } from '../../hooks/useUserBadges';

type UserBadgesProps = {
  userId: string;
  // Small inline icons for dense lists like the member list.
  size?: 'small' | 'normal';
};
export function UserBadges({ userId, size = 'normal' }: UserBadgesProps) {
  const badges = useUserBadges(userId);
  const box = toRem(size === 'small' ? 18 : 24);
  if (badges.length === 0) return null;

  return (
    <Box gap="100" alignItems="Center" wrap={size === 'small' ? 'NoWrap' : 'Wrap'}>
      {badges.map((badge) => (
        <TooltipProvider
          key={badge.id}
          position="Top"
          align="Center"
          tooltip={
            <Tooltip>
              <Text size="T200">{badge.label}</Text>
            </Tooltip>
          }
        >
          {(triggerRef) => (
            <Box
              ref={triggerRef}
              as="span"
              role="img"
              aria-label={badge.label}
              alignItems="Center"
              justifyContent="Center"
              style={{
                width: box,
                height: box,
                flexShrink: 0,
                borderRadius: config.radii.R300,
                color: badge.color,
                background: `color-mix(in srgb, ${badge.color} 16%, transparent)`,
                border: `1px solid color-mix(in srgb, ${badge.color} 35%, transparent)`,
              }}
            >
              <Icon size="50" src={badge.icon} filled />
            </Box>
          )}
        </TooltipProvider>
      ))}
    </Box>
  );
}
