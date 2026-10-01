import { ICreateRoomOpts, ICreateRoomStateEvent, MatrixClient, MatrixError } from 'matrix-js-sdk';
import { RoomType, StateEvent } from '../../../types/matrix/room';
import { getMxIdServer } from '../../utils/matrix';
import type { PowerLevelTags } from '../../hooks/usePowerLevelTags';
import { readSlowmode } from '../automod/automod';

type TemplateRole = { id: number | string; name: string; color: number; permissions: string };
type TemplateOverwrite = { id: number | string; type: number; allow: string; deny: string };
type TemplateChannel = {
  id: number | string;
  type: number;
  name: string;
  position: number;
  topic?: string | null;
  rate_limit_per_user?: number;
  parent_id?: number | string | null;
  permission_overwrites?: TemplateOverwrite[];
};
export type ServerTemplate = {
  code: string;
  name: string;
  description?: string | null;
  serialized_source_guild: {
    name: string;
    description?: string | null;
    roles: TemplateRole[];
    channels: TemplateChannel[];
  };
};

export type PlannedChannel = {
  name: string;
  topic?: string;
  kind: 'text' | 'voice' | 'announcement';
  private: boolean;
  readOnly: boolean;
  slowmode: number;
};
export type PlannedCategory = { name?: string; channels: PlannedChannel[] };
export type ImportPlan = {
  name: string;
  topic?: string;
  tags: PowerLevelTags;
  categories: PlannedCategory[];
  roleCount: number;
  droppedRoles: number;
  channelCount: number;
};

export const templateCode = (input: string): string | undefined => {
  const text = input.trim();
  const fromLink = /(?:discord\.new|discord(?:app)?\.com\/template)\/([\w-]+)/i.exec(text);
  if (fromLink) return fromLink[1];
  return /^[\w-]{4,64}$/.test(text) ? text : undefined;
};

export const fetchTemplate = async (code: string): Promise<ServerTemplate> => {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/templates/${encodeURIComponent(code)}`
  );
  if (res.status === 404) throw new Error("That template doesn't exist or was deleted.");
  if (!res.ok) throw new Error("The template couldn't be loaded. Try again in a minute.");
  const data = await res.json();
  if (!data?.serialized_source_guild?.channels) throw new Error("That isn't a server template.");
  return data;
};

const bit = (n: number) => BigInt(2) ** BigInt(n);
const PERM = {
  administrator: bit(3),
  manageServer: bit(5),
  manageChannels: bit(4),
  kick: bit(1),
  ban: bit(2),
  manageMessages: bit(13),
  timeout: bit(40),
  view: bit(10),
  send: bit(11),
};
const has = (bits: string, flag: bigint) => {
  try {
    return (BigInt(bits) / flag) % BigInt(2) === BigInt(1);
  } catch {
    return false;
  }
};
const hex = (value: number) => (value ? `#${value.toString(16).padStart(6, '0')}` : undefined);

// Admin roles get 100 and down, moderator roles 50 and up, the rest 1 to 49.
const planRoles = (roles: TemplateRole[]): { tags: PowerLevelTags; dropped: number } => {
  const ranked = roles.filter((r) => String(r.id) !== '0').reverse();
  const admins = ranked.filter(
    (r) => has(r.permissions, PERM.administrator) || has(r.permissions, PERM.manageServer)
  );
  const mods = ranked.filter(
    (r) =>
      !admins.includes(r) &&
      [PERM.manageChannels, PERM.kick, PERM.ban, PERM.manageMessages, PERM.timeout].some((f) =>
        has(r.permissions, f)
      )
  );
  const others = ranked.filter((r) => !admins.includes(r) && !mods.includes(r));

  const tags: PowerLevelTags = { 0: { name: 'Member' }, [-1]: { name: 'Muted', color: '#888888' } };
  const put = (role: TemplateRole, level: number) => {
    tags[level] = { name: role.name.slice(0, 64), color: hex(role.color) };
  };
  admins.slice(0, 49).forEach((r, i) => put(r, 100 - i));
  const modTop = Math.min(99 - Math.min(admins.length, 49), 50 + mods.length - 1);
  const keptMods = mods.slice(0, Math.max(0, modTop - 49));
  keptMods.forEach((r, i) => put(r, modTop - i));
  const keptOthers = others.slice(0, 49);
  keptOthers.forEach((r, i) => put(r, 49 - i));
  const kept = Math.min(admins.length, 49) + keptMods.length + keptOthers.length;
  return { tags, dropped: ranked.length - kept };
};

const everyoneDenies = (channel: TemplateChannel, flag: bigint) =>
  (channel.permission_overwrites ?? []).some(
    (o) => String(o.id) === '0' && o.type === 0 && has(o.deny, flag)
  );

const planChannel = (channel: TemplateChannel): PlannedChannel | undefined => {
  const kind = { 0: 'text', 5: 'announcement', 15: 'text', 16: 'text', 2: 'voice', 13: 'voice' }[
    channel.type
  ] as PlannedChannel['kind'] | undefined;
  if (!kind) return undefined;
  return {
    name: channel.name.slice(0, 100),
    topic: channel.topic?.slice(0, 1000) || undefined,
    kind,
    private: everyoneDenies(channel, PERM.view),
    readOnly: kind === 'announcement' || everyoneDenies(channel, PERM.send),
    slowmode: readSlowmode({ seconds: channel.rate_limit_per_user }),
  };
};

export const planImport = (template: ServerTemplate): ImportPlan => {
  const guild = template.serialized_source_guild;
  const byPosition = [...guild.channels].sort((a, b) => a.position - b.position);
  const loose: PlannedChannel[] = [];
  const categories = byPosition
    .filter((c) => c.type === 4)
    .map((c) => ({
      id: String(c.id),
      name: c.name.slice(0, 100),
      channels: [] as PlannedChannel[],
    }));
  byPosition.forEach((c) => {
    if (c.type === 4) return;
    const planned = planChannel(c);
    if (!planned) return;
    const category = categories.find((cat) => cat.id === String(c.parent_id));
    (category ? category.channels : loose).push(planned);
  });
  const { tags, dropped } = planRoles(guild.roles ?? []);
  const all = [{ channels: loose }, ...categories];
  return {
    name: (guild.name || template.name).slice(0, 100),
    topic: (guild.description || template.description)?.slice(0, 1000) || undefined,
    tags,
    categories: all.filter((c) => c.channels.length > 0 || 'name' in c),
    roleCount: Object.keys(tags).length - 2,
    droppedRoles: dropped,
    channelCount: all.reduce((n, c) => n + c.channels.length, 0),
  };
};

const withRetry = async <T>(action: () => Promise<T>, onWait: (ms: number) => void): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await action();
    } catch (e) {
      const err = e as MatrixError;
      if (err?.httpStatus !== 429 || attempt >= 20) throw e;
      const ms = err.getRetryAfterMs?.() ?? 5000;
      onWait(ms);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    }
  }
};

const ADMIN_ONLY_EVENTS = {
  [StateEvent.PowerLevelTags]: 100,
  [StateEvent.AngaaraSpaceTheme]: 100,
  [StateEvent.AngaaraRoomBanner]: 100,
};

export type ImportProgress = { done: number; total: number; step: string; waitMs?: number };

export const runImport = async (
  mx: MatrixClient,
  plan: ImportPlan,
  encryptAll: boolean,
  onProgress: (p: ImportProgress) => void
): Promise<string> => {
  const via = [getMxIdServer(mx.getSafeUserId()) ?? ''];
  const total = 1 + plan.categories.filter((c) => c.name).length + plan.channelCount;
  let done = 0;
  const step = (text: string) => onProgress({ done, total, step: text });
  const wait = (ms: number) =>
    onProgress({ done, total, step: 'Waiting for your server', waitMs: ms });

  const create = (opts: ICreateRoomOpts) =>
    withRetry<{ room_id: string }>(() => mx.createRoom(opts), wait).then((r) => {
      done += 1;
      return r.room_id;
    });
  const tagsState = { type: StateEvent.PowerLevelTags, state_key: '', content: plan.tags };
  const link = async (parentId: string, childId: string, order: number) => {
    await withRetry(
      () =>
        mx.sendStateEvent(
          parentId,
          StateEvent.SpaceChild as any,
          { via, suggested: false, order: String(order).padStart(4, '0') },
          childId
        ),
      wait
    );
  };
  const childState = (parentId: string, spaceId: string): ICreateRoomStateEvent[] => [
    { type: StateEvent.SpaceParent, state_key: parentId, content: { canonical: true, via } },
    {
      type: StateEvent.RoomJoinRules,
      state_key: '',
      content: {
        join_rule: 'restricted',
        allow: [{ type: 'm.room_membership', room_id: spaceId }],
      },
    },
  ];

  step(`Creating ${plan.name}`);
  const spaceId = await create({
    name: plan.name,
    topic: plan.topic,
    creation_content: { type: RoomType.Space },
    power_level_content_override: { events_default: 50, events: ADMIN_ONLY_EVENTS },
    initial_state: [tagsState],
  });

  const makeChannel = async (channel: PlannedChannel, parentId: string, order: number) => {
    step(`Creating #${channel.name}`);
    const state = childState(parentId, spaceId);
    if (channel.private)
      state[1] = {
        type: StateEvent.RoomJoinRules,
        state_key: '',
        content: { join_rule: 'invite' },
      };
    // Voice channels are always end-to-end encrypted.
    if (channel.private || encryptAll || channel.kind === 'voice') {
      state.push({
        type: 'm.room.encryption',
        state_key: '',
        content: { algorithm: 'm.megolm.v1.aes-sha2' },
      });
    }
    if (channel.slowmode > 0) {
      state.push({
        type: StateEvent.AngaaraSlowmode,
        state_key: '',
        content: { seconds: channel.slowmode },
      });
    }
    const voice = channel.kind === 'voice';
    if (voice) state.push({ type: 'org.matrix.msc3401.call', state_key: '', content: {} });
    const roomId = await create({
      name: channel.name,
      topic: channel.topic,
      creation_content: voice ? { type: RoomType.Call } : {},
      power_level_content_override: {
        events_default: channel.readOnly ? 50 : 0,
        events: voice
          ? { ...ADMIN_ONLY_EVENTS, [StateEvent.GroupCallMemberPrefix]: 0 }
          : ADMIN_ONLY_EVENTS,
      },
      initial_state: state,
    });
    await link(parentId, roomId, order);
  };

  let order = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const category of plan.categories) {
    let parentId = spaceId;
    if (category.name) {
      step(`Creating ${category.name}`);
      // eslint-disable-next-line no-await-in-loop
      parentId = await create({
        name: category.name,
        creation_content: { type: RoomType.Space },
        power_level_content_override: { events_default: 50, events: ADMIN_ONLY_EVENTS },
        initial_state: [...childState(spaceId, spaceId), tagsState],
      });
      order += 1;
      // eslint-disable-next-line no-await-in-loop
      await link(spaceId, parentId, order);
    }
    let channelOrder = 0;
    // eslint-disable-next-line no-restricted-syntax
    for (const channel of category.channels) {
      channelOrder += 1;
      order += 1;
      // eslint-disable-next-line no-await-in-loop
      await makeChannel(channel, parentId, category.name ? channelOrder : order);
    }
  }
  onProgress({ done: total, total, step: 'Done' });
  return spaceId;
};
