import React, { useState } from 'react';
import { Button, Icon, Icons, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useRoom } from '../../../hooks/useRoom';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { StateEvent } from '../../../../types/matrix/room';
import { copyToClipboard } from '../../../utils/dom';

function CopyRow({ title, value }: { title: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <SettingTile
      title={title}
      description={<span style={{ wordBreak: 'break-all' }}>{value}</span>}
      after={
        <Button
          variant="Secondary"
          fill="Soft"
          size="300"
          radii="300"
          outlined
          onClick={copy}
          before={<Icon size="100" src={copied ? Icons.Check : Icons.Link} />}
        >
          <Text size="B300">{copied ? 'Copied' : 'Copy'}</Text>
        </Button>
      }
    />
  );
}

// The server's address and ID up top, so they're easy to find and share.
export function SpaceAddress({ canEdit }: { canEdit: boolean }) {
  const room = useRoom();
  const content = useStateEvent(room, StateEvent.RoomCanonicalAlias)?.getContent();
  const alias: string | undefined = content?.alias;

  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      {alias ? (
        <CopyRow title="Server Address" value={alias} />
      ) : (
        <SettingTile
          title="Server Address"
          description={
            canEdit
              ? 'No address yet. Add one under Addresses below so people can find this server.'
              : 'No address yet.'
          }
        />
      )}
      <CopyRow title="Server ID" value={room.roomId} />
    </SequenceCard>
  );
}
