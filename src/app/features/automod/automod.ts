export type AutoModRule = { on: boolean; message: string };
export type AutoModListRule = AutoModRule & { list: string[] };
export type AutoModRules = {
  words: AutoModListRule;
  links: AutoModListRule;
  invites: AutoModRule;
  bot: boolean;
  commands: boolean;
};
export type AutoModViolation = { rule: 'words' | 'links' | 'invites'; message: string };

export const DEFAULT_MESSAGES = {
  words: "That message has a word this server doesn't allow.",
  links: "Links to that site aren't allowed here.",
  invites: "Invites to other servers aren't allowed here.",
};

export const SLOWMODE_STEPS = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600];
export const MAX_LIST = 200;
const MAX_ITEM = 100;
const MAX_MESSAGE = 200;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v: unknown, clean: (s: string) => string) =>
  Array.isArray(v)
    ? Array.from(
        new Set(v.map((i) => clean(str(i, MAX_ITEM))).filter((i): i is string => i !== ''))
      ).slice(0, MAX_LIST)
    : [];

export const cleanDomain = (input: string): string =>
  input
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#:\s]/)[0]
    .replace(/\.+$/, '');

const listRule = (v: unknown, fallback: string, clean: (s: string) => string) => {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    on: r.on === true,
    list: list(r.list, clean),
    message: str(r.message, MAX_MESSAGE) || fallback,
  };
};

export const readAutoMod = (content: unknown): AutoModRules => {
  const c = (content && typeof content === 'object' ? content : {}) as Record<string, unknown>;
  const inv = (c.invites && typeof c.invites === 'object' ? c.invites : {}) as Record<
    string,
    unknown
  >;
  return {
    words: listRule(c.words, DEFAULT_MESSAGES.words, (s) => s.toLowerCase()),
    links: listRule(c.links, DEFAULT_MESSAGES.links, cleanDomain),
    invites: {
      on: inv.on === true,
      message: str(inv.message, MAX_MESSAGE) || DEFAULT_MESSAGES.invites,
    },
    bot: c.bot === true,
    commands: c.commands === true,
  };
};

export const readSlowmode = (content: unknown): number => {
  const s = (content as { seconds?: unknown } | undefined)?.seconds;
  return typeof s === 'number' && Number.isFinite(s)
    ? Math.min(Math.max(Math.round(s), 0), 21600)
    : 0;
};

const fold = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0@]/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasWord = (text: string, words: string[]) => {
  const folded = fold(text);
  return words.some((w) => {
    const f = fold(w);
    // A trailing * matches any ending: "scam*" catches "scammer".
    const pattern = f.endsWith('*') ? `${escape(f.slice(0, -1))}\\w*` : escape(f);
    return new RegExp(`(^|[^\\p{L}\\p{N}])${pattern}($|[^\\p{L}\\p{N}])`, 'u').test(folded);
  });
};

const URL_RE = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(\/[^\s<>"')]*)?/gi;
const hostsIn = (text: string) =>
  Array.from(text.matchAll(URL_RE), (m) => ({
    host: m[1].toLowerCase().replace(/^www\./, ''),
    path: m[2] ?? '',
  }));

const matchesDomain = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

const INVITES: { host: string; path?: RegExp }[] = [
  { host: 'discord.gg' },
  { host: 'discord.com', path: /^\/invite\// },
  { host: 'discordapp.com', path: /^\/invite\// },
  { host: 'guilded.gg' },
  { host: 't.me' },
  { host: 'telegram.me' },
  { host: 'chat.whatsapp.com' },
  { host: 'revolt.chat', path: /^\/invite\// },
  { host: 'rvlt.gg' },
  { host: 'matrix.to', path: /^\/?#\/[#!+]/ },
];

const hasInvite = (text: string) =>
  hostsIn(text).some(({ host, path }) =>
    INVITES.some((i) => matchesDomain(host, i.host) && (!i.path || i.path.test(path)))
  ) || /matrix\.to\/#\/[#!+]/i.test(text);

export const checkMessage = (rules: AutoModRules, text: string): AutoModViolation | undefined => {
  if (rules.words.on && rules.words.list.length > 0 && hasWord(text, rules.words.list)) {
    return { rule: 'words', message: rules.words.message };
  }
  if (
    rules.links.on &&
    hostsIn(text).some(({ host }) => rules.links.list.some((d) => matchesDomain(host, d)))
  ) {
    return { rule: 'links', message: rules.links.message };
  }
  if (rules.invites.on && hasInvite(text)) {
    return { rule: 'invites', message: rules.invites.message };
  }
  return undefined;
};

export const formatSeconds = (s: number): string => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
};
