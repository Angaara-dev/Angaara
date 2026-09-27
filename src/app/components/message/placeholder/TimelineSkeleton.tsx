import React, { Ref } from 'react';
import { MessageBase } from '../layout';
import { CompactPlaceholder } from './CompactPlaceholder';
import { DefaultPlaceholder } from './DefaultPlaceholder';

// Fixed shapes so the block keeps its height between paginations.
const SHAPES: { lines: number; media?: boolean }[] = [
  { lines: 0, media: true },
  { lines: 2 },
  { lines: 0 },
  { lines: 1 },
  { lines: 0 },
  { lines: 3 },
  { lines: 0, media: true },
  { lines: 1 },
  { lines: 0 },
  { lines: 2 },
  { lines: 0 },
  { lines: 1 },
];
const COMPACT_ROWS = 24;

type TimelineSkeletonProps = {
  compact: boolean;
  // Paginator anchor, placed on the row nearest the loaded messages.
  anchorRef: Ref<HTMLDivElement>;
  anchorAt: 'start' | 'end';
};
// A tall block of message skeletons, so fast scrolling keeps going while history loads.
export function TimelineSkeleton({ compact, anchorRef, anchorAt }: TimelineSkeletonProps) {
  const count = compact ? COMPACT_ROWS : SHAPES.length;
  const anchorIndex = anchorAt === 'start' ? 0 : count - 1;
  return (
    <div aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <MessageBase key={i} ref={i === anchorIndex ? anchorRef : undefined}>
          {compact ? (
            <CompactPlaceholder />
          ) : (
            <DefaultPlaceholder lines={SHAPES[i].lines} media={SHAPES[i].media} />
          )}
        </MessageBase>
      ))}
    </div>
  );
}
