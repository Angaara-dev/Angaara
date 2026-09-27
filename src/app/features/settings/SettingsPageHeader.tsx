import React from 'react';
import { Box, Icon, IconButton, Icons, Text } from 'folds';
import { PageHeader } from '../../components/page';
import { usePhone } from '../../hooks/useScreenSize';

type SettingsPageHeaderProps = {
  title: string;
  requestClose: () => void;
};
// Phones get a back arrow to the settings list (like a native app); desktop keeps the close button.
export function SettingsPageHeader({ title, requestClose }: SettingsPageHeaderProps) {
  const mobile = usePhone();
  return (
    <PageHeader outlined={false}>
      <Box grow="Yes" gap="200" alignItems="Center">
        {mobile && (
          <IconButton onClick={requestClose} variant="Surface" aria-label="Back">
            <Icon src={Icons.ArrowLeft} />
          </IconButton>
        )}
        <Box grow="Yes" alignItems="Center" gap="200">
          <Text size="H3" truncate>
            {title}
          </Text>
        </Box>
        {!mobile && (
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface" aria-label="Close">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        )}
      </Box>
    </PageHeader>
  );
}
