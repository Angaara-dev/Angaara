import React from 'react';
import FocusTrap from 'focus-trap-react';
import { Modal, Overlay, OverlayBackdrop, OverlayCenter } from 'folds';
import { Room } from 'matrix-js-sdk';
import { Relations } from 'matrix-js-sdk/lib/models/relations';
import { ReactionViewer } from './ReactionViewer';
import { stopPropagation } from '../../../utils/keyboard';
import { usePhone } from '../../../hooks/useScreenSize';
import { BottomSheet } from '../../../components/bottom-sheet';

type ReactionViewerDialogProps = {
  room: Room;
  relations: Relations;
  initialKey?: string;
  open: boolean;
  onClose: () => void;
};
export function ReactionViewerDialog({
  room,
  relations,
  initialKey,
  open,
  onClose,
}: ReactionViewerDialogProps) {
  const phone = usePhone();
  const trapOptions = {
    initialFocus: false as const,
    returnFocusOnDeactivate: false,
    onDeactivate: onClose,
    clickOutsideDeactivates: true,
    escapeDeactivates: stopPropagation,
  };

  if (phone) {
    return (
      <BottomSheet open={open} onClose={onClose} label="Reactions" height="62vh">
        <ReactionViewer
          sheet
          room={room}
          initialKey={initialKey}
          relations={relations}
          requestClose={onClose}
          style={{ flexGrow: 1, minHeight: 0 }}
        />
      </BottomSheet>
    );
  }

  return (
    <Overlay
      onContextMenu={(evt: React.MouseEvent) => evt.stopPropagation()}
      open={open}
      backdrop={<OverlayBackdrop />}
    >
      <OverlayCenter>
        <FocusTrap focusTrapOptions={trapOptions}>
          <Modal variant="Surface" size="300">
            <ReactionViewer
              room={room}
              initialKey={initialKey}
              relations={relations}
              requestClose={onClose}
            />
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
