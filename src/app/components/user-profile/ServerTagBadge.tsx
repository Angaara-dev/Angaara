import React, { MouseEvent, useState } from 'react';
import { Box, RectCords, Text, Tooltip, TooltipProvider, color, config, toRem } from 'folds';
import { useServerTag } from '../../hooks/useServerTag';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { getRoomAvatarUrl } from '../../utils/room';
import { ServerTagCard } from './ServerTagCard';
import { TagIconView } from './serverTagIcons';

type ServerTagBadgeProps = {
  userId: string;
  // Pass false to skip the profile fetch, e.g. for member rows that scrolled past.
  enabled?: boolean;
  size?: 'small' | 'normal';
};
export function ServerTagBadge({ userId, enabled = true, size = 'small' }: ServerTagBadgeProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const serverTag = useServerTag(userId, enabled);
  const [anchor, setAnchor] = useState<RectCords>();
  if (!serverTag) return null;
  const { tag, space, spaceId, icon: tagIcon, color: tagColor } = serverTag;
  // The tag sits inside clickable names, which shouldn't open too.
  const open = (evt: MouseEvent<HTMLElement>) => {
    evt.stopPropagation();
    evt.preventDefault();
    setAnchor(evt.currentTarget.getBoundingClientRect());
  };
  const iconUrl = space ? getRoomAvatarUrl(mx, space, 32, useAuthentication) : undefined;
  // Pixel icons stay crisp at whole multiples of 16px.
  const icon = tagIcon ? toRem(16) : toRem(size === 'small' ? 12 : 14);

  return (
    <>
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
            as="button"
            type="button"
            onClick={open}
            aria-label={space ? `Server tag from ${space.name}` : 'Server tag'}
            shrink="No"
            alignItems="Center"
            gap="100"
            style={{
              width: 'fit-content',
              padding: `0 ${config.space.S100}`,
              height: toRem(size === 'small' ? 20 : 22),
              borderRadius: config.radii.R300,
              background: color.SurfaceVariant.Container,
              border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
              color: color.SurfaceVariant.OnContainer,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <TagIconView icon={tagIcon} color={tagColor} fallbackUrl={iconUrl} size={icon} />
            <Text as="span" size={size === 'small' ? 'L400' : 'T200'} style={{ fontWeight: 700 }}>
              {tag}
            </Text>
          </Box>
        )}
      </TooltipProvider>
      {anchor && (
        <ServerTagCard
          anchor={anchor}
          spaceId={spaceId}
          userId={userId}
          onClose={() => setAnchor(undefined)}
        />
      )}
    </>
  );
}
