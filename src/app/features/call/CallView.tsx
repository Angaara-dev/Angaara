import React, { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Box, color, Header, Scroll, Text, toRem } from 'folds';
import { useCallEmbed, useCallJoined, useCallEmbedPlacementSync } from '../../hooks/useCallEmbed';
import { ContainerColor } from '../../styles/ContainerColor.css';
import { PrescreenControls } from './PrescreenControls';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { StateEvent } from '../../../types/matrix/room';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { CallMemberRenderer } from './CallMemberCard';
import { CallEncryption } from './CallEncryption';
import * as css from './styles.css';
import { CallControls } from './CallControls';
import { TypingIndicator } from '../../components/typing-indicator';
import { useLivekitSupport } from '../../hooks/useLivekitSupport';
import { webRTCSupported } from '../../utils/rtc';

function LivekitServerMissingMessage() {
  return (
    <Text style={{ margin: 'auto', color: color.Critical.Main }} size="L400" align="Center">
      Your homeserver does not support calling.
    </Text>
  );
}

function WebRTCMissingError() {
  return (
    <Text style={{ margin: 'auto', color: color.Critical.Main }} size="L400" align="Center">
      Your browser does not support WebRTC, which is required for calling.
    </Text>
  );
}

function JoinMessage({
  hasParticipant,
  livekitSupported,
  rtcSupported,
}: {
  hasParticipant?: boolean;
  livekitSupported?: boolean;
  rtcSupported?: boolean;
}) {
  if (rtcSupported === false) {
    return <WebRTCMissingError />;
  }

  if (livekitSupported === false) {
    return <LivekitServerMissingMessage />;
  }

  if (hasParticipant) return null;

  return (
    <Text style={{ margin: 'auto' }} size="L400" align="Center">
      Voice chat’s empty — Be the first to hop in!
    </Text>
  );
}

function NoPermissionMessage() {
  return (
    <Text style={{ margin: 'auto' }} size="L400" align="Center">
      You don&#39;t have permission to join!
    </Text>
  );
}

function AlreadyInCallMessage() {
  return (
    <Text style={{ margin: 'auto', color: color.Warning.Main }} size="L400" align="Center">
      Already in another call — End the current call to join!
    </Text>
  );
}

function CallPrescreen() {
  const mx = useMatrixClient();
  const room = useRoom();
  const livekitSupported = useLivekitSupport();
  const rtcSupported = webRTCSupported();

  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const hasPermission = permissions.stateEvent(
    StateEvent.GroupCallMemberPrefix,
    mx.getSafeUserId()
  );

  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const hasParticipant = callMembers.length > 0;

  const callEmbed = useCallEmbed();
  const inOtherCall = callEmbed && callEmbed.roomId !== room.roomId;

  const canJoin = hasPermission && livekitSupported && rtcSupported;

  return (
    <Scroll variant="Surface" hideTrack>
      <Box className={css.CallViewContent} alignItems="Center" justifyContent="Center">
        <Box style={{ maxWidth: toRem(382), width: '100%' }} direction="Column" gap="100">
          {hasParticipant && (
            <Header size="300">
              <Box grow="Yes" alignItems="Center">
                <Text size="L400">Participant</Text>
              </Box>
              <Badge variant="Critical" fill="Solid" size="400">
                <Text as="span" size="L400" truncate>
                  {callMembers.length} Live
                </Text>
              </Badge>
            </Header>
          )}
          <CallMemberRenderer members={callMembers} />
          <PrescreenControls canJoin={canJoin} />
          <CallEncryption room={room} />
          <Box className={css.PrescreenMessage} alignItems="Center">
            {!inOtherCall &&
              (hasPermission ? (
                <JoinMessage
                  hasParticipant={hasParticipant}
                  livekitSupported={livekitSupported}
                  rtcSupported={rtcSupported}
                />
              ) : (
                <NoPermissionMessage />
              ))}
            {inOtherCall && <AlreadyInCallMessage />}
          </Box>
        </Box>
      </Box>
    </Scroll>
  );
}

type CallJoinedProps = {
  containerRef: RefObject<HTMLDivElement>;
  joined: boolean;
};
function CallJoined({ joined, containerRef }: CallJoinedProps) {
  const callEmbed = useCallEmbed();
  const [hover, setHover] = useState(false);
  const hideTimer = useRef<number>();

  // Controls float over the call and show while the pointer is on it.
  const show = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    setHover(true);
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHover(false), 600);
  }, []);
  useEffect(() => {
    const iframe = callEmbed?.iframe;
    if (!iframe) return undefined;
    iframe.addEventListener('mouseenter', show);
    iframe.addEventListener('mouseleave', hide);
    return () => {
      iframe.removeEventListener('mouseenter', show);
      iframe.removeEventListener('mouseleave', hide);
      window.clearTimeout(hideTimer.current);
    };
  }, [callEmbed, show, hide]);

  // Dots until the call has drawn something, so a freshly joined call isn't an empty box.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    const iframe = callEmbed?.iframe;
    if (!joined || !iframe) return undefined;
    const started = Date.now();
    const timer = window.setInterval(() => {
      let found = false;
      try {
        found = !!iframe.contentDocument?.querySelector('[class*="_tile_"], video');
      } catch {
        found = true;
      }
      if (found || Date.now() - started > 15000) {
        setDrawn(true);
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [callEmbed, joined]);

  return (
    <Box grow="Yes" direction="Column" style={{ position: 'relative' }}>
      <Box grow="Yes" ref={containerRef} alignItems="Center" justifyContent="Center">
        {joined && !drawn && (
          <TypingIndicator aria-label="Loading call" style={{ transform: 'scale(2)' }} />
        )}
      </Box>
      {callEmbed && joined && (
        <div className={css.CallOverlay} data-shown={hover} onMouseEnter={show} onMouseLeave={hide}>
          <CallEncryption room={callEmbed.room} keySize={callEmbed.keySize} />
          <CallControls callEmbed={callEmbed} />
        </div>
      )}
    </Box>
  );
}

export function CallView() {
  const room = useRoom();
  const callContainerRef = useRef<HTMLDivElement>(null);
  useCallEmbedPlacementSync(callContainerRef);

  const callEmbed = useCallEmbed();
  const callJoined = useCallJoined(callEmbed);

  const currentJoined = callEmbed?.roomId === room.roomId && callJoined;

  return (
    <Box
      className={ContainerColor({ variant: 'Surface' })}
      style={{ minWidth: toRem(280) }}
      grow="Yes"
    >
      {!currentJoined && <CallPrescreen />}
      <CallJoined joined={currentJoined} containerRef={callContainerRef} />
    </Box>
  );
}
