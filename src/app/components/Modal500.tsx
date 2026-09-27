import React, { CSSProperties, ReactNode } from 'react';
import FocusTrap from 'focus-trap-react';
import { Modal, Overlay, OverlayBackdrop, OverlayCenter } from 'folds';
import { stopPropagation } from '../utils/keyboard';
import { usePhone } from '../hooks/useScreenSize';
import { themeBackdrop } from '../styles/themeBackdrop';

// Phones: settings-style dialogs take the whole screen, like a native app page.
const FULL_SCREEN = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  maxWidth: 'none',
  maxHeight: 'none',
  borderRadius: 0,
} as const;

type Modal500Props = {
  requestClose: () => void;
  children: ReactNode;
  // Replaces the server theme with the dialog's own look, e.g. your profile colours.
  themeStyle?: CSSProperties;
};
export function Modal500({ requestClose, children, themeStyle }: Modal500Props) {
  const mobile = usePhone();
  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: requestClose,
            escapeDeactivates: stopPropagation,
          }}
        >
          {/* A server theme makes the Background colour see-through, so paint its gradient here. */}
          <Modal
            data-theme-wash={themeStyle ? undefined : true}
            size="500"
            variant="Background"
            style={{
              ...(themeStyle ?? themeBackdrop('bg')),
              ...(mobile ? FULL_SCREEN : undefined),
            }}
          >
            {children}
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
