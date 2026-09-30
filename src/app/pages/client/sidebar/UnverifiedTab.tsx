import React, { useState } from 'react';
import { color, Icon, Icons } from 'folds';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';
import { useDeviceList, useSplitCurrentDevice } from '../../../hooks/useDeviceList';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import * as css from './UnverifiedTab.css';
import {
  useDeviceVerificationStatus,
  VerificationStatus,
} from '../../../hooks/useDeviceVerificationStatus';
import { useCrossSigningActive } from '../../../hooks/useCrossSigning';
import { Settings, SettingsModal, SettingsPages } from '../../../features/settings';

function UnverifiedIndicator() {
  const mx = useMatrixClient();

  const crypto = mx.getCrypto();
  const [devices] = useDeviceList();

  const [currentDevice] = useSplitCurrentDevice(devices);

  const verificationStatus = useDeviceVerificationStatus(
    crypto,
    mx.getSafeUserId(),
    currentDevice?.device_id
  );
  const unverified = verificationStatus === VerificationStatus.Unverified;

  const [settings, setSettings] = useState(false);
  const closeSettings = () => setSettings(false);

  return (
    <>
      {unverified && (
        <SidebarItem active={settings} className={css.UnverifiedTab}>
          <SidebarItemTooltip tooltip="Unverified Device">
            {(triggerRef) => (
              <SidebarAvatar
                className={css.UnverifiedAvatar}
                as="button"
                ref={triggerRef}
                outlined
                onClick={() => setSettings(true)}
              >
                <Icon style={{ color: color.Critical.Main }} src={Icons.ShieldUser} />
              </SidebarAvatar>
            )}
          </SidebarItemTooltip>
        </SidebarItem>
      )}
      {settings && (
        <SettingsModal requestClose={closeSettings}>
          <Settings initialPage={SettingsPages.DevicesPage} requestClose={closeSettings} />
        </SettingsModal>
      )}
    </>
  );
}

export function UnverifiedTab() {
  const crossSigningActive = useCrossSigningActive();

  if (!crossSigningActive) return null;

  return <UnverifiedIndicator />;
}
