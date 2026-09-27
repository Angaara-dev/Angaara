import React, {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { toRem } from 'folds';
import * as css from './ResizeHandle.css';

export type ResizeHandleProps = {
  axis: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  // Dragging left/up grows the panel instead of right/down.
  invert?: boolean;
  label: string;
  // Hit area across the drag axis, in px.
  thickness?: number;
  // Dragging well below min snaps to 0 so the panel can be closed.
  collapsible?: boolean;
  onChange: (value: number) => void;
  onDoubleClick?: () => void;
};
export function ResizeHandle({
  axis,
  value,
  min,
  max,
  invert,
  label,
  thickness = 6,
  collapsible,
  onChange,
  onDoubleClick,
}: ResizeHandleProps) {
  const clamp = (v: number) => {
    if (collapsible && v < min * 0.6) return 0;
    return Math.round(Math.min(max, Math.max(min, v)));
  };
  const sign = invert ? -1 : 1;

  const handlePointerDown = (evt: ReactPointerEvent<HTMLButtonElement>) => {
    evt.preventDefault();
    const target = evt.currentTarget;
    const start = axis === 'x' ? evt.clientX : evt.clientY;
    target.setPointerCapture(evt.pointerId);
    const move = (e: PointerEvent) =>
      onChange(clamp(value + sign * ((axis === 'x' ? e.clientX : e.clientY) - start)));
    const stop = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  };

  const handleKeyDown = (evt: ReactKeyboardEvent<HTMLButtonElement>) => {
    const grow = axis === 'x' ? 'ArrowLeft' : 'ArrowDown';
    const shrink = axis === 'x' ? 'ArrowRight' : 'ArrowUp';
    const step = (invert ? 1 : -1) * (axis === 'x' ? 1 : -1) * 20;
    let delta: number;
    if (evt.key === grow) delta = step;
    else if (evt.key === shrink) delta = -step;
    else return;
    if (value === 0) {
      if (delta > 0) onChange(min);
    } else if (collapsible && delta < 0 && value <= min) onChange(0);
    else onChange(clamp(value + delta));
    evt.preventDefault();
  };

  return (
    <button
      type="button"
      aria-label={`${label} (drag, or use the arrow keys)`}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={onDoubleClick}
      data-no-swipe
      className={css.Handle}
      style={{
        cursor: axis === 'x' ? 'col-resize' : 'row-resize',
        ...(axis === 'x'
          ? { width: toRem(thickness), alignSelf: 'stretch' }
          : { height: toRem(thickness + 4), width: '100%' }),
      }}
    >
      <div
        className={css.Grip}
        style={{
          ...(axis === 'x'
            ? { width: toRem(2), height: toRem(40) }
            : { height: toRem(4), width: toRem(48) }),
        }}
      />
    </button>
  );
}
