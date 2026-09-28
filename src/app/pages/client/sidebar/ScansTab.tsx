import React, { useState } from 'react';
import { Icon, Icons } from 'folds';
import {
  SidebarAvatar,
  SidebarItem,
  SidebarItemBadge,
  SidebarItemTooltip,
} from '../../../components/sidebar';
import { UnreadBadge } from '../../../components/unread-badge';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { ScannedFilesDialog } from '../../../features/link-check/FileCheck';
import { useFileScans } from '../../../features/link-check/fileScans';

// Files checked on this device; the badge counts scans still running.
export function ScansTab() {
  const mx = useMatrixClient();
  const running = useFileScans(mx).filter((s) => s.status === 'scanning').length;
  const [open, setOpen] = useState(false);

  return (
    <SidebarItem active={open}>
      <SidebarItemTooltip tooltip="Scanned Files">
        {(triggerRef) => (
          <SidebarAvatar as="button" ref={triggerRef} outlined onClick={() => setOpen(true)}>
            <Icon src={Icons.Shield} filled={open} />
          </SidebarAvatar>
        )}
      </SidebarItemTooltip>
      {running > 0 && (
        <SidebarItemBadge hasCount>
          <UnreadBadge count={running} />
        </SidebarItemBadge>
      )}
      {open && <ScannedFilesDialog onClose={() => setOpen(false)} />}
    </SidebarItem>
  );
}
