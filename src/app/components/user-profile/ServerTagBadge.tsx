import React from 'react';
import { Box, Text, Tooltip, TooltipProvider, color, config, toRem } from 'folds';
import { useServerTag } from '../../hooks/useServerTag';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { getRoomAvatarUrl } from '../../utils/room';

type ServerTagBadgeProps = {
  userId: string;
  // Pass false to skip the profile fetch, e.g. for member rows that scrolled past.
  enabled?: boolean;
  size?: 'small' | 'normal';
};
// Server tag next to a name: the space's icon and its short tag.
export function ServerTagBadge({ userId, enabled = true, size = 'small' }: ServerTagBadgeProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const serverTag = useServerTag(userId, enabled);
  if (!serverTag) return null;
  const { tag, space } = serverTag;
  const iconUrl = space ? getRoomAvatarUrl(mx, space, 32, useAuthentication) : undefined;
  const icon = toRem(size === 'small' ? 12 : 14);

  return (
    <TooltipProvider
      position="Top"
      align="Center"
      tooltip={
        <Tooltip>
          <Text size="T200">{space ? `Server tag from ${space.name}` : 'Server tag'}</Text>
        </Tooltip>
      }
    >
      {(triggerRef) => (
        <Box
          ref={triggerRef}
          as="span"
          shrink="No"
          alignItems="Center"
          gap="100"
          style={{
            width: 'fit-content',
            padding: `0 ${config.space.S100}`,
            height: toRem(size === 'small' ? 18 : 20),
            borderRadius: config.radii.R300,
            background: color.SurfaceVariant.Container,
            border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
            color: color.SurfaceVariant.OnContainer,
          }}
        >
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              style={{ width: icon, height: icon, borderRadius: toRem(3), objectFit: 'cover' }}
            />
          )}
          <Text as="span" size={size === 'small' ? 'L400' : 'T200'} style={{ fontWeight: 700 }}>
            {tag}
          </Text>
        </Box>
      )}
    </TooltipProvider>
  );
}
