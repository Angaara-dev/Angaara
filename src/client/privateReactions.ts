import { EventType, MatrixClient, MatrixEvent, MatrixEventEvent, Room } from 'matrix-js-sdk';
import { StateEvent } from '../types/matrix/room';
import { sendEncrypted } from './sendEncrypted';

const MAX_KEY_LENGTH = 256;

export const privateReactionsOn = (room: Room): boolean =>
  room.hasEncryptionStateEvent() &&
  room.currentState.getStateEvents(StateEvent.AngaaraPrivateReactions, '')?.getContent()
    ?.enabled === true;

// In rooms with private reactions on, the emoji and target stay inside the ciphertext.
export const sendReaction = (mx: MatrixClient, room: Room, content: Record<string, unknown>) => {
  if (privateReactionsOn(room)) {
    return sendEncrypted(mx, room, EventType.Reaction, content, true);
  }
  return mx.sendEvent(room.roomId, EventType.Reaction, content as any);
};

// A private reaction only has its relation inside the ciphertext. Once decrypted, copy it out
// locally so the SDK counts it like any other reaction. Nothing is sent anywhere.
const revealRelation = (mx: MatrixClient, event: MatrixEvent) => {
  if (!event.isEncrypted() || event.isDecryptionFailure()) return;
  if (event.getType() !== EventType.Reaction) return;
  const wire = event.getWireContent();
  if (wire['m.relates_to']) return;

  const rel = event.getContent()['m.relates_to'];
  if (
    !rel ||
    rel.rel_type !== 'm.annotation' ||
    typeof rel.event_id !== 'string' ||
    typeof rel.key !== 'string' ||
    rel.key.length === 0 ||
    rel.key.length > MAX_KEY_LENGTH
  ) {
    return;
  }
  wire['m.relates_to'] = { rel_type: 'm.annotation', event_id: rel.event_id, key: rel.key };
  mx.getRoom(event.getRoomId())?.relations.aggregateChildEvent(event);
};

export const installPrivateReactions = (mx: MatrixClient) => {
  mx.on(MatrixEventEvent.Decrypted, (event) => revealRelation(mx, event));
};
