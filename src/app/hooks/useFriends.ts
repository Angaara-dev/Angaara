import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ClientEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import {
  FriendsData,
  getIncomingRequests,
  IncomingRequest,
  normalizeFriends,
} from '../../client/friends';
import { getVaultItem, getVaultStatus, subscribeVault, VaultStatus } from '../../client/vault';
import { useIgnoredUsers } from './useIgnoredUsers';

export const useVaultStatus = (): VaultStatus =>
  useSyncExternalStore(subscribeVault, getVaultStatus);

const getRawFriends = () => getVaultItem('friends');
export const useFriendsData = (): FriendsData => {
  const raw = useSyncExternalStore(subscribeVault, getRawFriends);
  return useMemo(() => normalizeFriends(raw), [raw]);
};

// Friend requests sent to you, updated as invites come and go or people get blocked.
export const useIncomingRequests = (): IncomingRequest[] => {
  const mx = useMatrixClient();
  const ignored = useIgnoredUsers();
  const [requests, setRequests] = useState(() => getIncomingRequests(mx));

  useEffect(() => {
    const update = () => setRequests(getIncomingRequests(mx));
    update();
    mx.on(RoomEvent.MyMembership, update);
    mx.on(ClientEvent.Room, update);
    mx.on(RoomStateEvent.Members, update);
    return () => {
      mx.removeListener(RoomEvent.MyMembership, update);
      mx.removeListener(ClientEvent.Room, update);
      mx.removeListener(RoomStateEvent.Members, update);
    };
  }, [mx, ignored]);

  return requests;
};
