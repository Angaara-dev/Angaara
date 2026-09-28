import React from 'react';
import { Box, Scroll } from 'folds';
import { Page, PageContent } from '../../../components/page';
import { MatrixId } from './MatrixId';
import { Profile } from './Profile';
import { ContactInformation } from './ContactInfo';
import { IgnoredUserList } from './IgnoredUserList';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { Experience } from './Experience';
import { PrivateMode } from './PrivateMode';

type AccountProps = {
  requestClose: () => void;
};
export function Account({ requestClose }: AccountProps) {
  return (
    <Page>
      <SettingsPageHeader title="Account" requestClose={requestClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Profile />
              <Experience />
              <MatrixId />
              <ContactInformation />
              <IgnoredUserList />
              <PrivateMode />
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
