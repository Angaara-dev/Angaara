import React, { MouseEventHandler, useCallback, useState } from 'react';
import { Box, Text, Tooltip, TooltipProvider, as, toRem } from 'folds';
import classNames from 'classnames';
import { Room } from 'matrix-js-sdk';
import { type Relations } from 'matrix-js-sdk/lib/models/relations';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { factoryEventSentBy } from '../../../utils/matrix';
import { Reaction, ReactionTooltipMsg } from '../../../components/message';
import { useRelations } from '../../../hooks/useRelations';
import * as css from './styles.css';
import { ReactionViewerDialog } from '../reaction-viewer';
import { usePhone } from '../../../hooks/useScreenSize';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';

export type ReactionsProps = {
  room: Room;
  mEventId: string;
  canSendReaction?: boolean;
  relations: Relations;
  onReactionToggle: (targetEventId: string, key: string, shortcode?: string) => void;
};
export const Reactions = as<'div', ReactionsProps>(
  ({ className, room, relations, mEventId, canSendReaction, onReactionToggle, ...props }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    // Phones have no hover, so tooltips just get stuck on screen after a long-press.
    const phone = usePhone();
    const [viewer, setViewer] = useState<boolean | string>(false);
    const myUserId = mx.getUserId();
    const reactions = useRelations(
      relations,
      useCallback((rel) => [...(rel.getSortedAnnotationsByKey() ?? [])], [])
    );

    const handleViewReaction: MouseEventHandler<HTMLButtonElement> = (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      const key = evt.currentTarget.getAttribute('data-reaction-key');
      if (!key) setViewer(true);
      else setViewer(key);
    };

    return (
      <Box
        className={classNames(css.ReactionsContainer, className)}
        gap="200"
        wrap="Wrap"
        {...props}
        ref={ref}
      >
        {reactions.map(([key, events]) => {
          const rEvents = Array.from(events);
          if (rEvents.length === 0 || typeof key !== 'string') return null;
          const myREvent = myUserId ? rEvents.find(factoryEventSentBy(myUserId)) : undefined;
          const isPressed = !!myREvent?.getRelation();

          const chip = (targetRef?: React.Ref<HTMLButtonElement>) => (
            <Reaction
              ref={targetRef}
              data-reaction-key={key}
              aria-pressed={isPressed}
              key={key}
              mx={mx}
              reaction={key}
              count={events.size}
              onClick={canSendReaction ? () => onReactionToggle(mEventId, key) : undefined}
              onContextMenu={handleViewReaction}
              aria-disabled={!canSendReaction}
              useAuthentication={useAuthentication}
            />
          );
          if (phone) return chip();

          return (
            <TooltipProvider
              key={key}
              position="Top"
              tooltip={
                <Tooltip style={{ maxWidth: toRem(200) }}>
                  <Text className={css.ReactionsTooltipText} size="T300">
                    <ReactionTooltipMsg room={room} reaction={key} events={rEvents} />
                  </Text>
                </Tooltip>
              }
            >
              {(targetRef) => chip(targetRef)}
            </TooltipProvider>
          );
        })}
        {reactions.length > 0 && (
          <ReactionViewerDialog
            room={room}
            relations={relations}
            initialKey={typeof viewer === 'string' ? viewer : undefined}
            open={!!viewer}
            onClose={() => setViewer(false)}
          />
        )}
      </Box>
    );
  }
);
