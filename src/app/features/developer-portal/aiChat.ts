import Anthropic from '@anthropic-ai/sdk';
import { atom } from 'jotai';
import { ZipFile } from '../../utils/zip';

export type AiProvider = 'anthropic' | 'openai';
// apiKey is the key for the active provider, picked from anthropicKey/openaiKey.
export type AiSettings = { provider: AiProvider; apiKey: string; model: string };

export const AI_SETTINGS_FILE = 'ai-settings.json';
const STORAGE_KEY = 'hearth.devtools.aiSettings';

export const MODELS: Record<AiProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    { id: 'claude-opus-5', label: 'Claude Opus 5' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
  ],
  openai: [
    { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
    { id: 'gpt-6-sol', label: 'GPT-6 Sol' },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
  ],
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
};

export const DEFAULT_AI_SETTINGS_JSON = `${JSON.stringify(
  { provider: 'anthropic', model: 'claude-opus-5', anthropicKey: '', openaiKey: '' },
  null,
  2
)}\n`;

export const parseAiSettings = (json: string): AiSettings | string => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return 'Not valid JSON yet.';
  }
  if (!raw || typeof raw !== 'object') return 'Settings must be a JSON object.';
  const s = raw as Record<string, unknown>;
  if (s.provider !== 'anthropic' && s.provider !== 'openai') {
    return 'provider must be "anthropic" or "openai".';
  }
  if (typeof s.model !== 'string' || !s.model.trim()) return "model can't be empty.";
  const key = s[`${s.provider}Key`] ?? '';
  if (typeof key !== 'string') return `${s.provider}Key must be a string.`;
  return { provider: s.provider, apiKey: key.trim(), model: s.model.trim() };
};

export const updateSettings = (json: string, changes: Record<string, string>): string => {
  try {
    return `${JSON.stringify({ ...JSON.parse(json), ...changes }, null, 2)}\n`;
  } catch {
    return json;
  }
};

// Keys stay in memory unless the user opts into remembering them on this device.
const loadSaved = (): string | undefined => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

export const saveAiSettings = (json: string | undefined) => {
  try {
    if (json === undefined) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Storage blocked (private window etc.); settings still work for this session.
  }
};

// Older settings had one apiKey; it becomes that provider's key so it's never sent to the other.
const migrate = (json: string): string => {
  try {
    const { apiKey, ...rest } = JSON.parse(json);
    if (
      typeof apiKey !== 'string' ||
      (rest.provider !== 'anthropic' && rest.provider !== 'openai')
    ) {
      return json;
    }
    const keyField = `${rest.provider}Key`;
    return `${JSON.stringify(
      { anthropicKey: '', openaiKey: '', ...rest, [keyField]: rest[keyField] || apiKey },
      null,
      2
    )}\n`;
  } catch {
    return json;
  }
};

const savedRaw = loadSaved();
const saved = savedRaw === undefined ? undefined : migrate(savedRaw);
export const aiSettingsJsonAtom = atom<string>(saved ?? DEFAULT_AI_SETTINGS_JSON);
export const aiRememberAtom = atom<boolean>(saved !== undefined);

// `content` is exactly what was sent, so earlier turns stay byte-identical and keep hitting the cache.
export type ChatTurn = { role: 'user' | 'assistant'; content: string; shown: string };
export const chatAtom = atom<ChatTurn[]>([]);

// Secrets never leave the browser.
const isSecret = (path: string) => (path.split('/').pop() ?? '').startsWith('.env');

const asFiles = (files: ZipFile[]) =>
  files.map((f) => `<file path="${f.path}">\n${f.content}\n</file>`).join('\n\n');

const INSTRUCTIONS = `You are a code reviewer and pair programmer inside Angaara's Developer Tools.
The user is building a Matrix bot in Rust with the angaara-bot SDK. The SDK source and the user's project are included below.
Review for bugs first, then clarity. Be concise and concrete: name the file and the code you mean.
When you suggest a change, show the changed code in a fenced block and say which file it goes in.
.env files are withheld on purpose because they hold secrets; never ask for their contents.`;

// SDK first (rarely changes), then the user's files (change as they edit), so edits only re-cache the second part.
const buildSystem = (files: ZipFile[], sdkPrefix: string) => {
  const visible = files.filter((f) => !isSecret(f.path));
  const sdk = visible.filter((f) => f.path.startsWith(sdkPrefix));
  const project = visible.filter((f) => !f.path.startsWith(sdkPrefix));
  return {
    stable: `${INSTRUCTIONS}\n\n<sdk>\n${asFiles(sdk)}\n</sdk>`,
    project: `<project>\n${asFiles(project)}\n</project>`,
  };
};

export type ChatResult = { text: string; cachedTokens?: number; inputTokens?: number };

const FALLBACK_MODELS = ['claude-opus-5', 'claude-fable-5-1'];

async function chatWithClaude(
  settings: AiSettings,
  system: { stable: string; project: string },
  turns: ChatTurn[],
  onText: (delta: string) => void,
  signal: AbortSignal
): Promise<ChatResult> {
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  const withFallback = FALLBACK_MODELS.includes(settings.model);
  const stream = client.beta.messages.stream(
    {
      model: settings.model,
      max_tokens: 64000,
      system: [
        { type: 'text', text: system.stable, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: system.project, cache_control: { type: 'ephemeral' } },
      ],
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
      // Caches the conversation so far, so each follow-up only pays for what's new.
      cache_control: { type: 'ephemeral' },
      ...(withFallback
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
    },
    { signal }
  );
  stream.on('text', onText);
  const message = await stream.finalMessage();
  const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  if (message.stop_reason === 'refusal') {
    return { text: text || 'Claude declined to answer this one.' };
  }
  return {
    text,
    cachedTokens: message.usage.cache_read_input_tokens ?? undefined,
    inputTokens:
      message.usage.input_tokens +
      (message.usage.cache_read_input_tokens ?? 0) +
      (message.usage.cache_creation_input_tokens ?? 0),
  };
}

// OpenAI caches long repeated prompt prefixes automatically, so the same ordering helps there too.
async function chatWithOpenAi(
  settings: AiSettings,
  system: { stable: string; project: string },
  turns: ChatTurn[],
  signal: AbortSignal
): Promise<ChatResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: `${system.stable}\n\n${system.project}` },
        ...turns.map((t) => ({ role: t.role, content: t.content })),
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI returned ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return {
    text: typeof text === 'string' ? text : '',
    cachedTokens: data?.usage?.prompt_tokens_details?.cached_tokens,
    inputTokens: data?.usage?.prompt_tokens,
  };
}

export async function sendChat(
  settings: AiSettings,
  files: ZipFile[],
  sdkPrefix: string,
  turns: ChatTurn[],
  onText: (delta: string) => void,
  signal: AbortSignal
): Promise<ChatResult> {
  const system = buildSystem(files, sdkPrefix);
  if (settings.provider === 'anthropic') {
    return chatWithClaude(settings, system, turns, onText, signal);
  }
  const result = await chatWithOpenAi(settings, system, turns, signal);
  onText(result.text);
  return result;
}

export const describeError = (e: unknown): string => {
  if (e instanceof Anthropic.AuthenticationError) return 'Invalid API key.';
  if (e instanceof Anthropic.PermissionDeniedError) return "Your key can't use this model.";
  if (e instanceof Anthropic.NotFoundError) return 'Unknown model. Pick another one.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited. Wait a moment and retry.';
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status ?? ''}: ${e.message}`;
  return e instanceof Error ? e.message : 'Request failed.';
};
