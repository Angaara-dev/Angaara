declare module 'libyara-wasm' {
  type Vector<T> = { size: () => number; get: (i: number) => T };
  export type YaraResult = {
    compileErrors: Vector<{ message: string; warning: boolean }>;
    matchedRules: Vector<{
      ruleName: string;
      metadata: Vector<{ identifier: string; data: string }>;
    }>;
  };
  export type Yara = { run: (data: Uint8Array, rules: string) => YaraResult };
  export default function createYara(): Promise<Yara>;
}
