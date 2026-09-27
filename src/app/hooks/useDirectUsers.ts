import { useMemo, useSyncExternalStore } from 'react';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { useAccountData } from './useAccountData';
import { useAllJoinedRoomsSet, useGetRoom } from './useGetRoom';
import { mergeDirects } from '../../client/directs';
import { getVaultItem, subscribeVault } from '../../client/vault';

const getVaultDirects = () => getVaultItem('direct');

export const useDirectUsers = (): string[] => {
  const directEvent = useAccountData(AccountDataEvent.Direct);
  // DMs kept in the encrypted vault, merged with any plaintext m.direct left over.
  const vaultDirects = useSyncExternalStore(subscribeVault, getVaultDirects);

  const allJoinedRooms = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allJoinedRooms);

  const users = useMemo(() => {
    const content = mergeDirects(directEvent?.getContent(), vaultDirects);
    return Object.keys(content).filter((userId) =>
      content[userId].some((roomId) => !!getRoom(roomId))
    );
  }, [directEvent, vaultDirects, getRoom]);

  return users;
};
