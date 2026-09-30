import React from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { useRoom } from '../../../hooks/useRoom';
import { usePowerLevels } from '../../../hooks/usePowerLevels';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { StateEvent } from '../../../../types/matrix/room';
import { Powers, PowersEditor } from '../../common-settings/permissions';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';
import { usePermissionGroups } from '../permissions/usePermissionItems';

export function Roles({ requestClose }: { requestClose: () => void }) {
  const mx = useMatrixClient();
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const permissionGroups = usePermissionGroups();
  const canEdit = permissions.stateEvent(StateEvent.PowerLevelTags, mx.getSafeUserId());

  if (canEdit) {
    return <PowersEditor powerLevels={powerLevels} requestClose={requestClose} standalone />;
  }

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Roles
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
            <Powers powerLevels={powerLevels} permissionGroups={permissionGroups} />
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
