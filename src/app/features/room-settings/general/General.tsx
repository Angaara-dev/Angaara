import React from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { usePowerLevels } from '../../../hooks/usePowerLevels';
import { useRoom } from '../../../hooks/useRoom';
import {
  RoomProfile,
  RoomEncryption,
  RoomHistoryVisibility,
  RoomJoinRules,
  RoomLocalAddresses,
  RoomPublishedAddresses,
  RoomPublish,
  RoomUpgrade,
  RoomCommands,
  RoomHiddenProfile,
  RoomPrivateReactions,
} from '../../common-settings/general';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { StateEvent } from '../../../../types/matrix/room';

type GeneralProps = {
  requestClose: () => void;
};
export function General({ requestClose }: GeneralProps) {
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const encrypted = !!useStateEvent(room, StateEvent.RoomEncryption);
  const me = useMatrixClient().getSafeUserId();
  // Settings you can't change are hidden, not greyed out.
  const can = (type: StateEvent) => permissions.stateEvent(type, me);
  const options = [
    can(StateEvent.RoomJoinRules) && <RoomJoinRules key="join" permissions={permissions} />,
    can(StateEvent.RoomHistoryVisibility) && (
      <RoomHistoryVisibility key="history" permissions={permissions} />
    ),
    can(StateEvent.RoomEncryption) && <RoomEncryption key="encryption" permissions={permissions} />,
    can(StateEvent.RoomCanonicalAlias) && <RoomPublish key="publish" permissions={permissions} />,
  ].filter(Boolean);
  const privacy = [
    can(StateEvent.AngaaraHiddenProfile) && (
      <RoomHiddenProfile key="hidden" permissions={permissions} />
    ),
    can(StateEvent.AngaaraPrivateReactions) && (
      <RoomPrivateReactions key="reactions" permissions={permissions} />
    ),
  ].filter(Boolean);

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              General
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <RoomProfile permissions={permissions} />
              {options.length > 0 && (
                <Box direction="Column" gap="100">
                  <Text size="L400">Options</Text>
                  {options}
                </Box>
              )}
              {encrypted && privacy.length > 0 && (
                <Box direction="Column" gap="100">
                  <Text size="L400">Privacy</Text>
                  {privacy}
                </Box>
              )}
              {can(StateEvent.AngaaraDisabledCommands) && (
                <Box direction="Column" gap="100">
                  <Text size="L400">Commands</Text>
                  <RoomCommands permissions={permissions} />
                </Box>
              )}
              {can(StateEvent.RoomCanonicalAlias) && (
                <Box direction="Column" gap="100">
                  <Text size="L400">Addresses</Text>
                  <RoomPublishedAddresses permissions={permissions} />
                  <RoomLocalAddresses permissions={permissions} />
                </Box>
              )}
              {can(StateEvent.RoomTombstone) && (
                <Box direction="Column" gap="100">
                  <Text size="L400">Advanced Options</Text>
                  <RoomUpgrade permissions={permissions} requestClose={requestClose} />
                </Box>
              )}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
