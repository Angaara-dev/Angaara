import React, { KeyboardEventHandler, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Box, Button, Chip, Icon, Icons, Spinner, Text, color, config, toRem } from 'folds';
import { ZipFile } from '../../utils/zip';
import { CopyChip } from './CodeBlock';
import { LoadingQuips } from './LoadingQuips';
import {
  AI_SETTINGS_FILE,
  AiProvider,
  AiSettings,
  MODELS,
  PROVIDER_LABELS,
  ChatResult,
  ChatTurn,
  aiRememberAtom,
  aiSettingsJsonAtom,
  chatAtom,
  describeError,
  parseAiSettings,
  saveAiSettings,
  sendChat,
  updateSettings,
} from './aiChat';

const CodeEditor = lazy(() => import('./CodeEditor'));

const QUICK_PROMPTS = [
  'Review this file for bugs.',
  'Review the whole project.',
  'How do I add a new command?',
];

function MessageBody({ text }: { text: string }) {
  const parts = text.split(/```[\w-]*\n?([\s\S]*?)```/g);
  return (
    <Box direction="Column" gap="200">
      {parts.map((part, i) => {
        if (!part.trim()) return null;
        const key = `${i}-${part.length}`;
        if (i % 2 === 1) {
          return (
            <Box key={key} direction="Column" gap="100">
              <pre
                style={{
                  margin: 0,
                  padding: config.space.S200,
                  borderRadius: config.radii.R300,
                  background: color.Background.Container,
                  overflowX: 'auto',
                  fontSize: '0.78rem',
                }}
              >
                <code>{part}</code>
              </pre>
              <Box>
                <CopyChip value={part} label="Copy Code" />
              </Box>
            </Box>
          );
        }
        return (
          <Text key={key} size="T300" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {part.trim()}
          </Text>
        );
      })}
    </Box>
  );
}

const CUSTOM = '__custom__';
const pickerStyle = {
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.R300,
  background: color.Secondary.Container,
  color: color.Secondary.OnContainer,
  border: `1px solid ${color.Secondary.ContainerLine}`,
};

function ModelPicker({ settings }: { settings: AiSettings }) {
  const setJson = useSetAtom(aiSettingsJsonAtom);
  const models = MODELS[settings.provider];
  const listed = models.some((m) => m.id === settings.model);
  const [custom, setCustom] = useState(!listed);
  const [draft, setDraft] = useState(settings.model);

  const applyCustom = () => {
    const model = draft.trim();
    if (model) setJson((j) => updateSettings(j, { model }));
  };

  return (
    <>
      <select
        value={settings.provider}
        onChange={(e) => {
          const provider = e.target.value as AiProvider;
          setCustom(false);
          setJson((j) => updateSettings(j, { provider, model: MODELS[provider][0].id }));
        }}
        aria-label="Provider"
        style={pickerStyle}
      >
        {(Object.keys(MODELS) as AiProvider[]).map((p) => (
          <option key={p} value={p}>
            {PROVIDER_LABELS[p]}
          </option>
        ))}
      </select>
      <select
        value={custom || !listed ? CUSTOM : settings.model}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setDraft(settings.model);
            setCustom(true);
            return;
          }
          setCustom(false);
          const model = e.target.value;
          setJson((j) => updateSettings(j, { model }));
        }}
        aria-label="Model"
        style={pickerStyle}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        <option value={CUSTOM}>Custom...</option>
      </select>
      {(custom || !listed) && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={applyCustom}
          onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
          placeholder="Model ID"
          aria-label="Custom model ID"
          spellCheck={false}
          style={{ ...pickerStyle, width: toRem(150) }}
        />
      )}
    </>
  );
}

function SettingsPanel() {
  const [json, setJson] = useAtom(aiSettingsJsonAtom);
  const [remember, setRemember] = useAtom(aiRememberAtom);
  const parsed = parseAiSettings(json);

  useEffect(() => {
    saveAiSettings(remember ? json : undefined);
  }, [json, remember]);

  let status = { text: 'Ready.', tone: color.Success.Main };
  if (typeof parsed === 'string') status = { text: parsed, tone: color.Critical.Main };
  else if (!parsed.apiKey) {
    status = { text: `Paste your key into ${parsed.provider}Key.`, tone: color.Warning.Main };
  }

  return (
    <Box direction="Column" gap="200">
      <Text size="L400">{AI_SETTINGS_FILE}</Text>
      <div style={{ height: toRem(130) }}>
        <Suspense fallback={<LoadingQuips />}>
          <CodeEditor path={AI_SETTINGS_FILE} value={json} onChange={setJson} />
        </Suspense>
      </div>
      <Text size="T200" style={{ color: status.tone }}>
        {status.text}
      </Text>
      <Box as="label" gap="100" alignItems="Center">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <Text size="T200">Remember on this device</Text>
      </Box>
      <Text size="T200" priority="300">
        Keys: anthropicKey from console.anthropic.com, openaiKey from platform.openai.com. Each key
        goes straight from this browser to its provider. It stays in memory unless you tick
        Remember. .env files are never sent.
      </Text>
    </Box>
  );
}

type AiChatProps = {
  files: ZipFile[];
  openFile?: string;
  sdkPrefix: string;
};
export function AiChat({ files, openFile, sdkPrefix }: AiChatProps) {
  const json = useAtomValue(aiSettingsJsonAtom);
  const [chat, setChat] = useAtom(chatAtom);
  const [streaming, setStreaming] = useState<string>();
  const [error, setError] = useState<string>();
  const [stats, setStats] = useState<ChatResult>();
  const [draft, setDraft] = useState('');
  const parsed = parseAiSettings(json);
  const settings = typeof parsed === 'string' ? undefined : parsed;
  const [showSettings, setShowSettings] = useState(!settings?.apiKey);
  const abortRef = useRef<AbortController>();
  const endRef = useRef<HTMLDivElement>(null);
  const busy = streaming !== undefined;

  // Braces matter: newer Chrome returns a Promise here, which React would treat as a cleanup.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [chat, streaming]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (question: string) => {
    if (!settings?.apiKey || busy || !question.trim()) {
      if (!settings?.apiKey) setShowSettings(true);
      return;
    }
    const where = openFile ? `I'm looking at ${openFile}.\n\n` : '';
    const turns: ChatTurn[] = [
      ...chat,
      { role: 'user', content: `${where}${question.trim()}`, shown: question.trim() },
    ];
    const controller = new AbortController();
    abortRef.current = controller;
    setChat(turns);
    setDraft('');
    setError(undefined);
    setStreaming('');
    let partial = '';
    try {
      const result = await sendChat(
        settings,
        files,
        sdkPrefix,
        turns,
        (delta) => {
          partial += delta;
          setStreaming(partial);
        },
        controller.signal
      );
      setChat([...turns, { role: 'assistant', content: result.text, shown: result.text }]);
      setStats(result);
    } catch (e) {
      if (controller.signal.aborted && partial) {
        setChat([
          ...turns,
          { role: 'assistant', content: partial, shown: `${partial}\n\n(stopped)` },
        ]);
      } else {
        // Roll back so the history never holds a question without an answer.
        setChat(chat);
        setDraft(question);
        if (!controller.signal.aborted) setError(describeError(e));
      }
    } finally {
      setStreaming(undefined);
    }
  };

  const handleKey: KeyboardEventHandler<HTMLTextAreaElement> = (evt) => {
    if (evt.key === 'Enter' && !evt.shiftKey) {
      evt.preventDefault();
      send(draft);
    }
  };

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        height: '100%',
        minHeight: 0,
        padding: config.space.S300,
        background: color.Surface.Container,
        color: color.Surface.OnContainer,
      }}
    >
      <Box alignItems="Center" gap="200" wrap="Wrap" shrink="No">
        <Icon size="100" src={Icons.Message} />
        <Text size="H6">AI Review</Text>
        <Box grow="Yes" />
        {settings && <ModelPicker settings={settings} />}
        <Chip
          variant={showSettings ? 'Primary' : 'SurfaceVariant'}
          radii="Pill"
          onClick={() => setShowSettings((v) => !v)}
          before={<Icon size="50" src={Icons.Setting} />}
        >
          <Text size="B300">Key</Text>
        </Chip>
        <Chip
          variant="SurfaceVariant"
          radii="Pill"
          disabled={busy || chat.length === 0}
          onClick={() => {
            setChat([]);
            setStats(undefined);
          }}
        >
          <Text size="B300">New Chat</Text>
        </Chip>
      </Box>

      {showSettings && <SettingsPanel />}

      <Box direction="Column" gap="300" grow="Yes" style={{ minHeight: 0, overflowY: 'auto' }}>
        {chat.length === 0 && !busy && (
          <Text size="T300" priority="300">
            Ask about your code. It sees every file in the project except .env files.
          </Text>
        )}
        {chat.map((turn, i) => (
          <Box
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            direction="Column"
            gap="100"
            style={{
              padding: config.space.S200,
              borderRadius: config.radii.R400,
              background:
                turn.role === 'user' ? color.Primary.Container : color.Background.Container,
              color:
                turn.role === 'user' ? color.Primary.OnContainer : color.Background.OnContainer,
              alignSelf: turn.role === 'user' ? 'flex-end' : 'stretch',
              maxWidth: turn.role === 'user' ? '85%' : undefined,
            }}
          >
            <MessageBody text={turn.shown} />
          </Box>
        ))}
        {busy && (
          <Box
            direction="Column"
            gap="100"
            style={{
              padding: config.space.S200,
              borderRadius: config.radii.R400,
              background: color.Background.Container,
              color: color.Background.OnContainer,
            }}
          >
            {streaming ? (
              <MessageBody text={streaming} />
            ) : (
              <Spinner size="200" variant="Secondary" />
            )}
          </Box>
        )}
        <div ref={endRef} />
      </Box>

      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
      {stats?.inputTokens !== undefined && (
        <Text size="T200" priority="300">
          Last reply read {(stats.cachedTokens ?? 0).toLocaleString()} of{' '}
          {stats.inputTokens.toLocaleString()} input tokens from cache.
        </Text>
      )}
      <Box gap="100" wrap="Wrap" shrink="No">
        {QUICK_PROMPTS.map((prompt) => (
          <Chip
            key={prompt}
            variant="SurfaceVariant"
            radii="Pill"
            disabled={busy}
            onClick={() => send(prompt)}
          >
            <Text size="B300">{prompt}</Text>
          </Chip>
        ))}
      </Box>
      <Box gap="200" alignItems="End" shrink="No">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          placeholder="Ask about your code (Enter to send, Shift+Enter for a new line)"
          aria-label="Message"
          style={{
            flexGrow: 1,
            minWidth: 0,
            resize: 'none',
            padding: config.space.S200,
            borderRadius: config.radii.R300,
            border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
            background: color.Background.Container,
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: toRem(14),
            lineHeight: 1.4,
          }}
        />
        {busy ? (
          <Button
            style={{ flexShrink: 0 }}
            size="300"
            variant="Critical"
            fill="Soft"
            radii="300"
            onClick={() => abortRef.current?.abort()}
          >
            <Text size="B300">Stop</Text>
          </Button>
        ) : (
          <Button
            style={{ flexShrink: 0 }}
            size="300"
            variant="Primary"
            radii="300"
            onClick={() => send(draft)}
          >
            <Text size="B300">Send</Text>
          </Button>
        )}
      </Box>
    </Box>
  );
}
