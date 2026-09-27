import { EventType, MatrixEvent, MatrixEventEvent, MatrixEventHandlerMap } from 'matrix-js-sdk';
import React, { ReactElement, ReactNode, useEffect, useState } from 'react';
import { MessageEvent } from '../../../../types/matrix/room';
import { HIDDEN_PROFILE_EVENT } from '../../../../client/hiddenProfile';

type EncryptedContentProps = {
  mEvent: MatrixEvent;
  children: () => ReactNode;
};

export function EncryptedContent({ mEvent, children }: EncryptedContentProps) {
  const [, toggleEncrypted] = useState(mEvent.getType() === MessageEvent.RoomMessageEncrypted);

  useEffect(() => {
    toggleEncrypted(mEvent.getType() === MessageEvent.RoomMessageEncrypted);
    const handleDecrypted: MatrixEventHandlerMap[MatrixEventEvent.Decrypted] = (event) => {
      toggleEncrypted(event.getType() === MessageEvent.RoomMessageEncrypted);
    };
    mEvent.on(MatrixEventEvent.Decrypted, handleDecrypted);
    return () => {
      mEvent.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [mEvent]);

  return <>{children()}</>;
}

// Private reactions and hidden room names only reveal their type once decrypted; drop the row then.
const isHiddenType = (mEvent: MatrixEvent) =>
  mEvent.getType() === EventType.Reaction || mEvent.getType() === HIDDEN_PROFILE_EVENT;

export function HideDecryptedMeta({
  mEvent,
  children,
}: {
  mEvent: MatrixEvent;
  children: ReactElement;
}) {
  const [hidden, setHidden] = useState(isHiddenType(mEvent));

  useEffect(() => {
    const handleDecrypted = () => setHidden(isHiddenType(mEvent));
    handleDecrypted();
    mEvent.on(MatrixEventEvent.Decrypted, handleDecrypted);
    return () => {
      mEvent.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [mEvent]);

  return hidden ? null : children;
}
