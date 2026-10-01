import React, { PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useParams } from 'react-router-dom';
import { Box, Text, TooltipProvider, Tooltip, Icon, Icons, IconButton, toRem } from 'folds';
import { Page, PageHeader } from '../../components/page';
import { callChatAtom } from '../../state/callEmbed';
import { RoomView } from './RoomView';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import * as css from './CallChatView.css';

const WIDTH_KEY = 'angaara_call_chat_width';
const MIN_CHAT = 320;
const MIN_CALL = 320;

const savedWidth = (): number | undefined => {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    return v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
};

export function CallChatView() {
  const { eventId } = useParams();
  const setChat = useSetAtom(callChatAtom);
  const screenSize = useScreenSizeContext();

  const handleClose = () => setChat(false);

  // Drag the left edge to resize; the call keeps whatever room is left.
  const pageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | undefined>(savedWidth);
  const startResize = (evt: ReactPointerEvent<HTMLDivElement>) => {
    const page = pageRef.current;
    const parent = page?.parentElement;
    if (!page || !parent) return;
    evt.preventDefault();
    const handle = evt.currentTarget;
    handle.setPointerCapture(evt.pointerId);
    const { right } = page.getBoundingClientRect();
    const max = parent.clientWidth - MIN_CALL;
    const embed = document.querySelector<HTMLElement>('[data-call-embed-container]');
    embed?.style.setProperty('pointer-events', 'none');
    let last = width;
    const move = (e: PointerEvent) => {
      last = Math.round(Math.max(MIN_CHAT, Math.min(right - e.clientX, max)));
      setWidth(last);
    };
    const up = () => {
      embed?.style.removeProperty('pointer-events');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      try {
        if (last) localStorage.setItem(WIDTH_KEY, String(last));
      } catch {
        // The width just isn't remembered.
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };
  const desktop = screenSize === ScreenSize.Desktop;

  return (
    <Page
      ref={pageRef}
      style={{
        // The chat gets the larger share by default; the call keeps the rest.
        position: 'relative',
        width: desktop
          ? `min(${width ? `${width}px` : '60%'}, calc(100% - ${MIN_CALL}px))`
          : '100%',
        minWidth: desktop ? toRem(MIN_CHAT) : undefined,
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      {desktop && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat"
          className={css.ResizeHandle}
          onPointerDown={startResize}
        />
      )}
      <PageHeader>
        <Box grow="Yes" alignItems="Center" gap="200">
          <Box grow="Yes">
            <Text size="H5" truncate>
              Chat
            </Text>
          </Box>
          <Box shrink="No" alignItems="Center">
            <TooltipProvider
              position="Bottom"
              align="End"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>Close</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton ref={triggerRef} variant="Surface" onClick={handleClose}>
                  <Icon src={Icons.Cross} />
                </IconButton>
              )}
            </TooltipProvider>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes" direction="Column">
        <RoomView eventId={eventId} />
      </Box>
    </Page>
  );
}
