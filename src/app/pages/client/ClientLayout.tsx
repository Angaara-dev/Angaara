import React, { ReactNode } from 'react';
import { Box } from 'folds';
import { SwipeNavigation } from '../../components/SwipeNavigation';
import { usePhone } from '../../hooks/useScreenSize';
import { TopBar } from './TopBar';

type ClientLayoutProps = {
  nav: ReactNode;
  children: ReactNode;
};
export function ClientLayout({ nav, children }: ClientLayoutProps) {
  const phone = usePhone();
  return (
    <Box grow="Yes" direction="Column">
      {!phone && <TopBar />}
      <Box grow="Yes" style={{ minHeight: 0 }}>
        <SwipeNavigation nav={nav}>{children}</SwipeNavigation>
      </Box>
    </Box>
  );
}
