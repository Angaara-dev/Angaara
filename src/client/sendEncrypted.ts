import { MatrixClient, MatrixEvent, Method, Room } from 'matrix-js-sdk';

type Encryptor = { encryptEvent(event: MatrixEvent, room: Room): Promise<void> };

// Encrypts first and sends the ciphertext, so this can never go out as plain text.
// With hideRelation, the relation stays only inside the ciphertext too.
export const sendEncrypted = async (
  mx: MatrixClient,
  room: Room,
  type: string,
  content: Record<string, unknown>,
  hideRelation = false
): Promise<string> => {
  const crypto = mx.getCrypto() as unknown as Encryptor | undefined;
  if (!crypto || !room.hasEncryptionStateEvent()) {
    throw new Error('This room is not end-to-end encrypted.');
  }
  const event = new MatrixEvent({
    type,
    content,
    room_id: room.roomId,
    sender: mx.getSafeUserId(),
  });
  await crypto.encryptEvent(event, room);
  if (event.getWireType() !== 'm.room.encrypted') throw new Error('Encryption failed.');

  const wire = { ...event.getWireContent() };
  if (hideRelation) delete wire['m.relates_to'];
  // Sent directly (no local echo) so our own copy arrives via sync and decrypts like any other.
  const path = `/rooms/${encodeURIComponent(
    room.roomId
  )}/send/m.room.encrypted/${encodeURIComponent(mx.makeTxnId())}`;
  const res = await mx.http.authedRequest<{ event_id: string }>(Method.Put, path, undefined, wire);
  return res.event_id;
};
