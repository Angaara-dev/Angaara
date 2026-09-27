import React from 'react';
import { Box, Text } from 'folds';
import Linkify from 'linkify-react';
import { LINKIFY_OPTS, scaleSystemEmoji } from '../../plugins/react-custom-html-parser';
import { useUserBio } from '../../hooks/useUserBio';

type UserBioProps = {
  userId: string;
  // Caps the lines shown, for compact places like the hover card.
  maxLines?: number;
};
export function UserBio({ userId, maxLines }: UserBioProps) {
  const bio = useUserBio(userId);
  if (!bio) return null;

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">About Me</Text>
      <Text
        size="T300"
        priority="400"
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...(maxLines && {
            display: '-webkit-box',
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }),
        }}
      >
        <Linkify options={LINKIFY_OPTS}>{scaleSystemEmoji(bio)}</Linkify>
      </Text>
    </Box>
  );
}
