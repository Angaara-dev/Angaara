import { JoinRule } from 'matrix-js-sdk';
import { AvatarFallback, AvatarImage, Icon, Icons } from 'folds';
import React, { ComponentProps, ReactEventHandler, ReactNode, forwardRef, useState } from 'react';
import * as css from './RoomAvatar.css';
import { getRoomIconSrc } from '../../utils/room';

type RoomAvatarProps = {
  // Unused since fallbacks dropped per-room colors; kept so callers don't change.
  // eslint-disable-next-line react/no-unused-prop-types
  roomId: string;
  src?: string;
  alt?: string;
  renderFallback: () => ReactNode;
};
export function RoomAvatar({ src, alt, renderFallback }: RoomAvatarProps) {
  const [error, setError] = useState(false);

  const handleLoad: ReactEventHandler<HTMLImageElement> = (evt) => {
    evt.currentTarget.setAttribute('data-image-loaded', 'true');
  };

  if (!src || error) {
    return (
      <AvatarFallback className={css.RoomAvatar} data-solid-tint>
        {renderFallback()}
      </AvatarFallback>
    );
  }

  return (
    <AvatarImage
      className={css.RoomAvatar}
      src={src}
      alt={alt}
      onError={() => setError(true)}
      onLoad={handleLoad}
      draggable={false}
    />
  );
}

export const RoomIcon = forwardRef<
  SVGSVGElement,
  Omit<ComponentProps<typeof Icon>, 'src'> & {
    joinRule?: JoinRule;
    roomType?: string;
  }
>(({ joinRule, roomType, ...props }, ref) => (
  <Icon src={getRoomIconSrc(Icons, roomType, joinRule)} {...props} ref={ref} />
));
