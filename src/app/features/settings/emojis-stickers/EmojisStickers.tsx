import React, { useState } from 'react';
import { Box, Scroll } from 'folds';
import { Page, PageContent } from '../../../components/page';
import { GlobalPacks } from './GlobalPacks';
import { UserPack } from './UserPack';
import { ImagePack } from '../../../plugins/custom-emoji';
import { ImagePackView } from '../../../components/image-pack-view';
import { SettingsPageHeader } from '../SettingsPageHeader';

type EmojisStickersProps = {
  requestClose: () => void;
};
export function EmojisStickers({ requestClose }: EmojisStickersProps) {
  const [imagePack, setImagePack] = useState<ImagePack>();

  const handleImagePackViewClose = () => {
    setImagePack(undefined);
  };

  if (imagePack) {
    return <ImagePackView address={imagePack.address} requestClose={handleImagePackViewClose} />;
  }

  return (
    <Page>
      <SettingsPageHeader title="Emojis & Stickers" requestClose={requestClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <UserPack onViewPack={setImagePack} />
              <GlobalPacks onViewPack={setImagePack} />
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
