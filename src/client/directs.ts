import { MatrixClient } from 'matrix-js-sdk';
import { AccountDataEvent } from '../types/matrix/accountData';
import { getVaultItem, updateVaultItem, vaultReady } from './vault';

// Who you have DMs with, kept in the encrypted vault instead of plaintext m.direct.
// Until the vault is open on this device, the old m.direct list is still used.
export type DirectMap = Record<string, string[]>;

const clean = (content: unknown): DirectMap => {
  const out: DirectMap = {};
  if (!content || typeof content !== 'object') return out;
  Object.entries(content as Record<string, unknown>).forEach(([userId, rooms]) => {
    if (!Array.isArray(rooms)) return;
    const ids = rooms.filter((r): r is string => typeof r === 'string');
    if (ids.length > 0) out[userId] = ids;
  });
  return out;
};

const plainDirects = (mx: MatrixClient) =>
  clean(mx.getAccountData(AccountDataEvent.Direct as any)?.getContent());

const merge = (a: DirectMap, b: DirectMap): DirectMap => {
  const out: DirectMap = structuredClone(a);
  Object.entries(b).forEach(([userId, rooms]) => {
    out[userId] = Array.from(new Set([...(out[userId] ?? []), ...rooms]));
  });
  return out;
};

export const mergeDirects = (plain: unknown, vault: unknown): DirectMap =>
  merge(clean(plain), clean(vault));

export const getDirectMap = (mx: MatrixClient): DirectMap =>
  mergeDirects(
    mx.getAccountData(AccountDataEvent.Direct as any)?.getContent(),
    getVaultItem('direct')
  );

const withRoom = (map: DirectMap, roomId: string, userId?: string): DirectMap => {
  const out: DirectMap = {};
  Object.entries(map).forEach(([uid, rooms]) => {
    const rest = rooms.filter((r) => r !== roomId);
    if (rest.length > 0) out[uid] = rest;
  });
  // A room can only be a DM with one person.
  if (userId) out[userId] = [...(out[userId] ?? []), roomId];
  return out;
};

// Moves any plaintext m.direct entries into the vault and empties m.direct.
export async function migrateDirectsToVault(mx: MatrixClient) {
  if (!vaultReady()) return;
  const plain = plainDirects(mx);
  if (Object.keys(plain).length === 0) return;
  await updateVaultItem<DirectMap>('direct', (prev) => merge(clean(prev), plain));
  await mx.setAccountData(AccountDataEvent.Direct as any, {} as any);
}

export async function setDirectRoom(mx: MatrixClient, roomId: string, userId?: string) {
  if (vaultReady()) {
    await updateVaultItem<DirectMap>('direct', (prev) => withRoom(clean(prev), roomId, userId));
    const plain = plainDirects(mx);
    if (Object.values(plain).some((rooms) => rooms.includes(roomId))) {
      await mx.setAccountData(AccountDataEvent.Direct as any, withRoom(plain, roomId) as any);
    }
    return;
  }
  await mx.setAccountData(
    AccountDataEvent.Direct as any,
    withRoom(plainDirects(mx), roomId, userId) as any
  );
}
