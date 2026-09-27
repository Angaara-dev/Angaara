import React, { ComponentProps, CSSProperties, MutableRefObject, ReactNode, useState } from 'react';
import { Box, Header, Line, Scroll, Text, as } from 'folds';
import classNames from 'classnames';
import { ContainerColor } from '../../styles/ContainerColor.css';
import * as css from './style.css';
import { ScreenSize, usePhone, useScreenSizeContext } from '../../hooks/useScreenSize';
import { ResizeHandle } from '../resize-handle';

type PageRootProps = {
  nav: ReactNode;
  children: ReactNode;
  // Main app screens: nav and content float as rounded panels on the app frame.
  framed?: boolean;
};

const NAV_WIDTH_KEY = 'hearth.navWidth';
const NAV_OPEN_WIDTH_KEY = 'hearth.navOpenWidth';
const NAV_MAX_WIDTH = 320;
// 0 means the room list is collapsed.
const loadWidth = (key: string): number => {
  try {
    const saved = localStorage.getItem(key);
    const width = Number(saved);
    return saved !== null && width >= 0 ? Math.min(width, NAV_MAX_WIDTH) : 256;
  } catch {
    return 256;
  }
};
const saveWidth = (key: string, width: number) => {
  try {
    localStorage.setItem(key, String(width));
  } catch {
    // Width just isn't remembered when storage is blocked.
  }
};
// createVar gives "var(--name)"; inline styles need the bare "--name".
const navWidthProp = css.NavWidth.slice(4, -1);

export function PageRoot({ nav, children, framed }: PageRootProps) {
  const screenSize = useScreenSizeContext();
  const [navWidth, setNavWidth] = useState(() => loadWidth(NAV_WIDTH_KEY));
  const collapsed = navWidth === 0;

  const resizeNav = (width: number) => {
    setNavWidth(width);
    saveWidth(NAV_WIDTH_KEY, width);
    if (width > 0) saveWidth(NAV_OPEN_WIDTH_KEY, width);
  };
  const toggleNav = () => resizeNav(collapsed ? loadWidth(NAV_OPEN_WIDTH_KEY) || 256 : 0);

  if (framed && screenSize !== ScreenSize.Mobile) {
    return (
      <Box
        grow="Yes"
        className={classNames(ContainerColor({ variant: 'Background' }), css.Frame)}
        style={{ [navWidthProp]: `${navWidth}px` } as CSSProperties}
      >
        {nav && (
          <Box
            shrink="No"
            className={css.FramePanel}
            style={collapsed ? { display: 'none' } : undefined}
          >
            {nav}
          </Box>
        )}
        {nav && (
          <ResizeHandle
            axis="x"
            label={collapsed ? 'Open room list' : 'Resize room list'}
            value={navWidth}
            min={200}
            max={NAV_MAX_WIDTH}
            thickness={collapsed ? 12 : 8}
            collapsible
            onChange={resizeNav}
            onDoubleClick={toggleNav}
          />
        )}
        <Box grow="Yes" className={css.FramePanel}>
          {children}
        </Box>
      </Box>
    );
  }

  return (
    <Box grow="Yes" className={ContainerColor({ variant: 'Background' })}>
      {nav}
      {screenSize !== ScreenSize.Mobile && (
        <Line variant="Background" size="300" direction="Vertical" />
      )}
      {children}
    </Box>
  );
}

type ClientDrawerLayoutProps = {
  children: ReactNode;
};
export function PageNav({ size, children }: ClientDrawerLayoutProps & css.PageNavVariants) {
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const phone = usePhone();

  return (
    <Box
      grow={isMobile ? 'Yes' : undefined}
      className={classNames(css.PageNav({ size }), phone && css.PageNavMobileBackdrop)}
      shrink={isMobile ? 'Yes' : 'No'}
    >
      <Box grow="Yes" direction="Column" className={phone ? css.PageNavMobile : undefined}>
        {children}
      </Box>
    </Box>
  );
}

export const PageNavHeader = as<'header', css.PageNavHeaderVariants>(
  ({ className, outlined, ...props }, ref) => (
    <Header
      className={classNames(css.PageNavHeader({ outlined }), className)}
      variant="Background"
      size="600"
      {...props}
      ref={ref}
    />
  )
);

export function PageNavContent({
  scrollRef,
  children,
}: {
  children: ReactNode;
  scrollRef?: MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <Box grow="Yes" direction="Column">
      <Scroll
        ref={scrollRef}
        variant="Background"
        direction="Vertical"
        size="300"
        hideTrack
        visibility="Hover"
      >
        <div className={css.PageNavContent}>{children}</div>
      </Scroll>
    </Box>
  );
}

export const Page = as<'div'>(({ className, ...props }, ref) => (
  <Box
    grow="Yes"
    direction="Column"
    className={classNames(ContainerColor({ variant: 'Surface' }), className)}
    {...props}
    ref={ref}
  />
));

export const PageHeader = as<'div', css.PageHeaderVariants>(
  ({ className, outlined, balance, ...props }, ref) => (
    <Header
      as="header"
      size="600"
      className={classNames(css.PageHeader({ balance, outlined }), className)}
      {...props}
      ref={ref}
    />
  )
);

export const PageContent = as<'div'>(({ className, ...props }, ref) => (
  <div className={classNames(css.PageContent, className)} {...props} ref={ref} />
));

export function PageHeroEmpty({ children }: { children: ReactNode }) {
  return (
    <Box
      className={classNames(ContainerColor({ variant: 'SurfaceVariant' }), css.PageHeroEmpty)}
      direction="Column"
      alignItems="Center"
      justifyContent="Center"
      gap="200"
    >
      {children}
    </Box>
  );
}

export const PageHeroSection = as<'div', ComponentProps<typeof Box>>(
  ({ className, ...props }, ref) => (
    <Box
      direction="Column"
      className={classNames(css.PageHeroSection, className)}
      {...props}
      ref={ref}
    />
  )
);

export function PageHero({
  icon,
  title,
  subTitle,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  subTitle: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box direction="Column" gap="400">
      <Box direction="Column" alignItems="Center" gap="200">
        {icon}
      </Box>
      <Box as="h2" direction="Column" gap="200" alignItems="Center">
        <Text align="Center" size="H2">
          {title}
        </Text>
        <Text align="Center" priority="400">
          {subTitle}
        </Text>
      </Box>
      {children}
    </Box>
  );
}

export const PageContentCenter = as<'div'>(({ className, ...props }, ref) => (
  <div className={classNames(css.PageContentCenter, className)} {...props} ref={ref} />
));
