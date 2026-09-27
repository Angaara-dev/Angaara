import React from 'react';
import { Box, Text, Scroll } from 'folds';
import { Page, PageContent } from '../../../components/page';
import { SystemNotification } from './SystemNotification';
import { AllMessagesNotifications } from './AllMessages';
import { SpecialMessagesNotifications } from './SpecialMessages';
import { KeywordMessagesNotifications } from './KeywordMessages';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { SettingsPageHeader } from '../SettingsPageHeader';

type NotificationsProps = {
  requestClose: () => void;
};
export function Notifications({ requestClose }: NotificationsProps) {
  return (
    <Page>
      <SettingsPageHeader title="Notifications" requestClose={requestClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <SystemNotification />
              <AllMessagesNotifications />
              <SpecialMessagesNotifications />
              <KeywordMessagesNotifications />
              <Box direction="Column" gap="100">
                <Text size="L400">Block Messages</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    description={'This option has been moved to "Account > Block Users" section.'}
                  />
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
