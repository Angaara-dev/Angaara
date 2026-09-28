import createYara, { Yara } from 'libyara-wasm';

export type YaraMatch = { rule: string; meta: Record<string, string> };

const ctx = globalThis as unknown as {
  postMessage: (message: unknown) => void;
  onmessage:
    | ((ev: MessageEvent<{ id: number; bytes: Uint8Array; rulesUrl: string }>) => void)
    | null;
};

let yara: Promise<Yara> | undefined;
let rules: Promise<string> | undefined;

const list = <T>(v: { size: () => number; get: (i: number) => T }): T[] =>
  Array.from({ length: v.size() }, (_, i) => v.get(i));

// Runs the YARA rules off the main thread, so big files don't freeze the app.
ctx.onmessage = async (evt) => {
  try {
    yara ??= createYara();
    rules ??= fetch(evt.data.rulesUrl).then((res) => {
      if (!res.ok) throw new Error('rules');
      return res.text();
    });
    const result = (await yara).run(evt.data.bytes, await rules);
    if (list(result.compileErrors).some((e) => !e.warning)) throw new Error('rules');
    const matches: YaraMatch[] = list(result.matchedRules).map((m) => ({
      rule: m.ruleName,
      meta: Object.fromEntries(list(m.metadata).map((x) => [x.identifier, x.data])),
    }));
    ctx.postMessage({ id: evt.data.id, matches });
  } catch {
    yara = undefined;
    rules = undefined;
    ctx.postMessage({ id: evt.data.id, error: true });
  }
};
