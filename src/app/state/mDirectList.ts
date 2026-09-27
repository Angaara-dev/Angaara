import { atom, useSetAtom } from 'jotai';
import { ClientEvent, MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useEffect } from 'react';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { getDirectMap, migrateDirectsToVault } from '../../client/directs';
import { subscribeVault } from '../../client/vault';

export type MDirectAction = {
  type: 'INITIALIZE' | 'UPDATE';
  rooms: Set<string>;
};

const baseMDirectAtom = atom(new Set<string>());
export const mDirectAtom = atom<Set<string>, [MDirectAction], undefined>(
  (get) => get(baseMDirectAtom),
  (get, set, action) => {
    set(baseMDirectAtom, action.rooms);
  }
);

const directRoomIds = (mx: MatrixClient) => new Set(Object.values(getDirectMap(mx)).flat());

// DM rooms from both the encrypted vault and any plaintext m.direct left over.
export const useBindMDirectAtom = (mx: MatrixClient, mDirect: typeof mDirectAtom) => {
  const setMDirect = useSetAtom(mDirect);

  useEffect(() => {
    setMDirect({ type: 'INITIALIZE', rooms: directRoomIds(mx) });

    const refresh = () => {
      setMDirect({ type: 'UPDATE', rooms: directRoomIds(mx) });
      migrateDirectsToVault(mx).catch(() => undefined);
    };
    const handleAccountData = (event: MatrixEvent) => {
      if (event.getType() === AccountDataEvent.Direct) refresh();
    };

    mx.on(ClientEvent.AccountData, handleAccountData);
    const unsubscribe = subscribeVault(refresh);
    return () => {
      mx.removeListener(ClientEvent.AccountData, handleAccountData);
      unsubscribe();
    };
  }, [mx, setMDirect]);
};
