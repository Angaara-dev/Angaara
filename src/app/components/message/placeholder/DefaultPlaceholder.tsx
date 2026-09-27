import React, { CSSProperties, useMemo } from 'react';
import { Avatar, Box, ContainerColor, as, color, config, toRem } from 'folds';
import { randomNumberBetween } from '../../../utils/common';
import { LinePlaceholder } from './LinePlaceholder';
import { ModernLayout } from '../layout';

const contentMargin: CSSProperties = { marginTop: toRem(3) };

type DefaultPlaceholderProps = {
  variant?: ContainerColor;
  // Extra message lines and an image block, for skeleton variety.
  lines?: number;
  media?: boolean;
};
export const DefaultPlaceholder = as<'div', DefaultPlaceholderProps>(
  ({ variant, lines = 0, media, ...props }, ref) => {
    const nameSize = useMemo(() => randomNumberBetween(40, 100), []);
    const msgSize = useMemo(() => randomNumberBetween(80, 200), []);
    const msg2Size = useMemo(() => randomNumberBetween(80, 200), []);
    const lineSizes = useMemo(
      () => Array.from({ length: lines }, () => randomNumberBetween(160, 400)),
      [lines]
    );

    return (
      <ModernLayout
        {...props}
        ref={ref}
        before={
          <Avatar
            style={{ backgroundColor: color[variant ?? 'SurfaceVariant'].Container }}
            size="300"
          />
        }
      >
        <Box style={contentMargin} grow="Yes" direction="Column" gap="200">
          <Box grow="Yes" gap="200" alignItems="Center" justifyContent="SpaceBetween">
            <LinePlaceholder variant={variant} style={{ maxWidth: toRem(nameSize) }} />
            <LinePlaceholder variant={variant} style={{ maxWidth: toRem(50) }} />
          </Box>
          <Box grow="Yes" gap="200" wrap="Wrap">
            <LinePlaceholder variant={variant} style={{ maxWidth: toRem(msgSize) }} />
            <LinePlaceholder variant={variant} style={{ maxWidth: toRem(msg2Size) }} />
          </Box>
          {lineSizes.map((size, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <LinePlaceholder key={i} variant={variant} style={{ maxWidth: toRem(size) }} />
          ))}
          {media && (
            <Box
              style={{
                width: '100%',
                maxWidth: toRem(340),
                height: toRem(180),
                borderRadius: config.radii.R400,
                backgroundColor: color[variant ?? 'SurfaceVariant'].Container,
              }}
            />
          )}
        </Box>
      </ModernLayout>
    );
  }
);
