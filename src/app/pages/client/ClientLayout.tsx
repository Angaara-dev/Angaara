import React, { ReactNode } from 'react';
import { Box } from 'folds';
import { SwipeNavigation } from '../../components/SwipeNavigation';

type ClientLayoutProps = {
  nav: ReactNode;
  children: ReactNode;
};
export function ClientLayout({ nav, children }: ClientLayoutProps) {
  return (
    <Box grow="Yes">
      <SwipeNavigation nav={nav}>{children}</SwipeNavigation>
    </Box>
  );
}
