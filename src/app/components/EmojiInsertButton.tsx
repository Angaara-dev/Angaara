import React, { RefObject, useState } from 'react';
import { Icon, IconButton, Icons, PopOut, RectCords } from 'folds';
import { EmojiBoard } from './emoji-board';

type EmojiInsertButtonProps = {
  inputRef: RefObject<HTMLInputElement>;
  disabled?: boolean;
};

export function EmojiInsertButton({ inputRef, disabled }: EmojiInsertButtonProps) {
  const [anchor, setAnchor] = useState<RectCords>();

  const insert = (unicode: string) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.setRangeText(unicode, start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  };

  return (
    <PopOut
      anchor={anchor}
      position="Bottom"
      align="End"
      content={
        <EmojiBoard
          imagePackRooms={[]}
          returnFocusOnDeactivate={false}
          allowTextCustomEmoji={false}
          onEmojiSelect={(unicode) => {
            insert(unicode);
            setAnchor(undefined);
          }}
          requestClose={() => setAnchor(undefined)}
        />
      }
    >
      <IconButton
        type="button"
        size="300"
        radii="300"
        variant="SurfaceVariant"
        aria-label="Add emoji"
        aria-pressed={!!anchor}
        disabled={disabled}
        onClick={(evt: React.MouseEvent<HTMLButtonElement>) =>
          setAnchor(evt.currentTarget.getBoundingClientRect())
        }
      >
        <Icon size="100" src={Icons.Smile} />
      </IconButton>
    </PopOut>
  );
}
