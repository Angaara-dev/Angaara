import React, { MouseEvent, ReactNode, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { PopOut, RectCords } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { stopPropagation } from '../../utils/keyboard';
import { CallEmbed } from '../../plugins/call/CallEmbed';
import { canEditServerSounds } from '../../plugins/soundboard/library';
import { Sound } from '../../plugins/soundboard/types';
import { SoundboardPanel } from './SoundboardPanel';
import { AddSoundDialog } from './AddSoundDialog';

type AddTarget = { personal: Sound[]; server?: Room; serverSounds: Sound[] };

type SoundboardPopoutProps = {
  embed: CallEmbed;
  position?: 'Top' | 'Bottom';
  children: (toggle: (evt: MouseEvent<HTMLElement>) => void, open: boolean) => ReactNode;
};
// Wraps any button so it opens the soundboard; the add dialog sits outside the popout.
export function SoundboardPopout({ embed, position = 'Top', children }: SoundboardPopoutProps) {
  const mx = useMatrixClient();
  const [cords, setCords] = useState<RectCords>();
  const [adding, setAdding] = useState<AddTarget>();

  const toggle = (evt: MouseEvent<HTMLElement>) =>
    setCords(cords ? undefined : evt.currentTarget.getBoundingClientRect());

  return (
    <>
      <PopOut
        anchor={cords}
        position={position}
        align="Center"
        offset={8}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setCords(undefined),
              clickOutsideDeactivates: true,
              escapeDeactivates: stopPropagation,
            }}
          >
            <div>
              <SoundboardPanel
                embed={embed}
                onAdd={(target) => {
                  setCords(undefined);
                  setAdding(target);
                }}
              />
            </div>
          </FocusTrap>
        }
      >
        {children(toggle, !!cords)}
      </PopOut>
      {adding && (
        <AddSoundDialog
          personal={adding.personal}
          server={adding.server}
          serverSounds={adding.serverSounds}
          canEditServer={canEditServerSounds(mx, adding.server)}
          requestClose={() => setAdding(undefined)}
        />
      )}
    </>
  );
}
