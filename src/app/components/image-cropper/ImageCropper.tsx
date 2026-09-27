import React, { PointerEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  color,
  config,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  toRem,
} from 'folds';
import { useObjectURL } from '../../hooks/useObjectURL';
import { stopPropagation } from '../../utils/keyboard';
import { CropRect, cropImageFile } from '../../utils/cropImage';

export type CropPreset = {
  title: string;
  // Width divided by height of where the image is shown.
  aspect: number;
  // Recommended upload size; the crop is scaled down to this width.
  width: number;
  height: number;
  round?: boolean;
};
export const cropSizeLabel = (preset: CropPreset) => `${preset.width} × ${preset.height} px`;

type Drag = {
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  start: CropRect;
  // Resize anchor: the corner opposite the handle, and which way the handle points.
  ax: number;
  ay: number;
  dirX: number;
  dirY: number;
};

const largestCrop = (w: number, h: number, aspect: number): CropRect => {
  const width = Math.min(w, h * aspect);
  const height = width / aspect;
  return { x: (w - width) / 2, y: (h - height) / 2, width, height };
};
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

type ImageCropperProps = {
  file: File;
  preset: CropPreset;
  onCancel: () => void;
  onDone: (file: File) => void;
};
// GitHub-style cropper: drag the box to move it, drag a corner to resize.
export function ImageCropper({ file, preset, onCancel, onDone }: ImageCropperProps) {
  const url = useObjectURL(file);
  const [natural, setNatural] = useState<{ w: number; h: number }>();
  const [rect, setRect] = useState<CropRect>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const drag = useRef<Drag>();
  const { aspect } = preset;

  const maxW = Math.min(560, window.innerWidth - 64);
  const maxH = Math.min(380, window.innerHeight - 260);
  const scale = natural ? Math.min(maxW / natural.w, maxH / natural.h) : 1;

  useEffect(() => {
    if (!natural) return;
    setRect(largestCrop(natural.w, natural.h, aspect));
  }, [natural, aspect]);

  const onPointerDown = (evt: PointerEvent<HTMLDivElement>) => {
    if (!rect || busy) return;
    evt.preventDefault();
    evt.currentTarget.setPointerCapture(evt.pointerId);
    const { handle: corner } = (evt.target as HTMLElement).dataset;
    const dirX = corner?.includes('e') ? 1 : -1;
    const dirY = corner?.includes('s') ? 1 : -1;
    drag.current = {
      mode: corner ? 'resize' : 'move',
      startX: evt.clientX,
      startY: evt.clientY,
      start: rect,
      ax: dirX > 0 ? rect.x : rect.x + rect.width,
      ay: dirY > 0 ? rect.y : rect.y + rect.height,
      dirX,
      dirY,
    };
  };

  const onPointerMove = (evt: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !natural) return;
    const dx = (evt.clientX - d.startX) / scale;
    const dy = (evt.clientY - d.startY) / scale;
    if (d.mode === 'move') {
      setRect({
        ...d.start,
        x: clamp(d.start.x + dx, 0, natural.w - d.start.width),
        y: clamp(d.start.y + dy, 0, natural.h - d.start.height),
      });
      return;
    }
    const roomX = d.dirX > 0 ? natural.w - d.ax : d.ax;
    const roomY = (d.dirY > 0 ? natural.h - d.ay : d.ay) * aspect;
    const minW = Math.min(32 / scale, roomX, roomY);
    const width = clamp(
      Math.max(d.start.width + dx * d.dirX, (d.start.height + dy * d.dirY) * aspect),
      minW,
      Math.min(roomX, roomY)
    );
    const height = width / aspect;
    setRect({
      width,
      height,
      x: d.dirX > 0 ? d.ax : d.ax - width,
      y: d.dirY > 0 ? d.ay : d.ay - height,
    });
  };

  const onPointerUp = () => {
    drag.current = undefined;
  };

  const apply = useCallback(() => {
    if (!rect) return;
    setBusy(true);
    setError(undefined);
    cropImageFile(file, rect, preset.width)
      .then(onDone)
      .catch(() => {
        setBusy(false);
        setError("Couldn't crop this image. You can still use it as it is.");
      });
  }, [file, rect, preset.width, onDone]);

  const renderHandle = (name: string, style: React.CSSProperties): ReactNode => (
    <div
      data-handle={name}
      style={{
        position: 'absolute',
        width: toRem(14),
        height: toRem(14),
        background: 'white',
        borderRadius: toRem(3),
        boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
        cursor: name === 'nw' || name === 'se' ? 'nwse-resize' : 'nesw-resize',
        touchAction: 'none',
        ...style,
      }}
    />
  );

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: onCancel,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface" style={{ maxWidth: '96vw', width: 'auto' }}>
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">{preset.title}</Text>
              </Box>
              <IconButton
                type="button"
                size="300"
                onClick={onCancel}
                radii="300"
                aria-label="Cancel"
              >
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
              <Box
                justifyContent="Center"
                style={{
                  minWidth: toRem(240),
                  minHeight: toRem(120),
                  background: color.SurfaceVariant.Container,
                  borderRadius: config.radii.R300,
                }}
              >
                {url && (
                  <div
                    style={{
                      position: 'relative',
                      width: natural ? natural.w * scale : undefined,
                      height: natural ? natural.h * scale : undefined,
                      overflow: 'hidden',
                      userSelect: 'none',
                    }}
                  >
                    <img
                      src={url}
                      alt=""
                      draggable={false}
                      onLoad={(evt) =>
                        setNatural({
                          w: evt.currentTarget.naturalWidth,
                          h: evt.currentTarget.naturalHeight,
                        })
                      }
                      style={{
                        display: 'block',
                        width: natural ? natural.w * scale : undefined,
                        maxWidth: natural ? undefined : maxW,
                        maxHeight: natural ? undefined : maxH,
                      }}
                    />
                    {rect && (
                      <div
                        role="presentation"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                        style={{
                          position: 'absolute',
                          left: rect.x * scale,
                          top: rect.y * scale,
                          width: rect.width * scale,
                          height: rect.height * scale,
                          border: '2px solid white',
                          borderRadius: preset.round ? '50%' : undefined,
                          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                          cursor: 'move',
                          touchAction: 'none',
                        }}
                      >
                        {renderHandle('nw', { left: -8, top: -8 })}
                        {renderHandle('ne', { right: -8, top: -8 })}
                        {renderHandle('sw', { left: -8, bottom: -8 })}
                        {renderHandle('se', { right: -8, bottom: -8 })}
                      </div>
                    )}
                  </div>
                )}
              </Box>
              <Text size="T200" priority="300">
                {`Drag to move, drag a corner to resize. Saved at up to ${cropSizeLabel(preset)}${
                  file.type === 'image/gif' ? '; GIFs stay animated' : ''
                }.`}
              </Text>
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  {error}
                </Text>
              )}
              <Box gap="200" justifyContent="End">
                <Button
                  type="button"
                  variant="Secondary"
                  fill="Soft"
                  size="300"
                  radii="300"
                  onClick={() => onDone(file)}
                  disabled={busy}
                >
                  <Text size="B300">Use without cropping</Text>
                </Button>
                <Button
                  type="button"
                  variant="Primary"
                  size="300"
                  radii="300"
                  onClick={apply}
                  disabled={busy || !rect}
                  before={busy ? <Spinner size="100" variant="Primary" fill="Solid" /> : undefined}
                >
                  <Text size="B300">{busy ? 'Cropping…' : 'Apply'}</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

// Anything that isn't a croppable image skips straight through, so callers still validate it.
const SKIP = ['image/svg+xml'];
export function useImageCropper(preset: CropPreset, onDone: (file: File) => void) {
  const [file, setFile] = useState<File>();
  const open = useCallback(
    (picked?: File) => {
      if (!picked) return;
      if (!picked.type.startsWith('image/') || SKIP.includes(picked.type)) onDone(picked);
      else setFile(picked);
    },
    [onDone]
  );
  const cropper = file ? (
    <ImageCropper
      file={file}
      preset={preset}
      onCancel={() => setFile(undefined)}
      onDone={(cropped) => {
        setFile(undefined);
        onDone(cropped);
      }}
    />
  ) : null;
  return { open, cropper };
}
