import React, { useRef } from 'react';
import { Badge, Box, config, Scroll, Text } from 'folds';

import {
  Sidebar,
  SidebarContent,
  SidebarStackSeparator,
  SidebarStack,
} from '../../components/sidebar';
import {
  DirectTab,
  HomeTab,
  SpaceTabs,
  InboxTab,
  ExploreTab,
  UnverifiedTab,
  SearchTab,
  ScansTab,
} from './sidebar';
import { CreateTab } from './sidebar/CreateTab';
import { useScrollFade } from '../../hooks/useScrollFade';
import { ScrollFade } from '../../styles/ScrollFade.css';
import { usePhone } from '../../hooks/useScreenSize';

export function SidebarNav() {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollFade(scrollRef);
  const phone = usePhone();

  return (
    <Sidebar>
      <SidebarContent
        scrollable={
          <Scroll ref={scrollRef} className={ScrollFade} variant="Background" size="0">
            {/* The phone layout is still rough, so it's labelled as beta. */}
            {phone && (
              <Box justifyContent="Center" style={{ paddingTop: config.space.S200 }}>
                <Badge variant="Warning" fill="Solid" radii="Pill" size="400">
                  <Text as="span" size="L400">
                    BETA
                  </Text>
                </Badge>
              </Box>
            )}
            <SidebarStack>
              <HomeTab />
              <DirectTab />
            </SidebarStack>
            <SpaceTabs scrollRef={scrollRef} />
            <SidebarStackSeparator />
            <SidebarStack>
              <ExploreTab />
              <CreateTab />
            </SidebarStack>
          </Scroll>
        }
        sticky={
          <>
            <SidebarStackSeparator />
            <SidebarStack>
              <SearchTab />
              <ScansTab />
              <UnverifiedTab />
              {/* On bigger screens the inbox lives in the top bar. */}
              {phone && <InboxTab />}
            </SidebarStack>
          </>
        }
      />
    </Sidebar>
  );
}
