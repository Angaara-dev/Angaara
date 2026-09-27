import React, { DragEventHandler, useState } from 'react';
import { Spinner, Text, color, config, toRem } from 'folds';
import { useFilePicker } from '../../hooks/useFilePicker';

export const IMAGE_ACCEPT = 'image/gif,image/png,image/jpeg,image/webp';

type ImageDropZoneProps = {
  imageUrl?: string;
  height: number;
  // Fixed width, so the preview matches where the image is really shown.
  width?: number;
  label: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  busy?: boolean;
};
// Click or drop an image; shows the current image as its background.
export function ImageDropZone({
  imageUrl,
  height,
  width,
  label,
  onFile,
  disabled,
  busy,
}: ImageDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const pickFile = useFilePicker((file?: File) => file && onFile(file), false);

  const onDrop: DragEventHandler<HTMLButtonElement> = (evt) => {
    evt.preventDefault();
    setDragging(false);
    const file = evt.dataTransfer.files[0];
    if (!disabled && file) onFile(file);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => pickFile(IMAGE_ACCEPT)}
      onDragOver={(evt) => {
        evt.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      aria-label={`Upload ${label}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: width ? toRem(width) : '100%',
        maxWidth: '100%',
        height: toRem(height),
        padding: 0,
        borderRadius: config.radii.R400,
        border: `2px ${imageUrl && !dragging ? 'solid' : 'dashed'} ${
          dragging ? color.Primary.Main : color.SurfaceVariant.ContainerLine
        }`,
        background: imageUrl
          ? `center / cover no-repeat url("${imageUrl}")`
          : color.SurfaceVariant.ContainerHover,
        color: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {busy ? (
        <Spinner size="200" variant="Secondary" />
      ) : (
        !imageUrl && (
          <Text size="T300" priority="300">
            {dragging ? 'Drop it!' : 'Click or drop an image or GIF'}
          </Text>
        )
      )}
    </button>
  );
}
