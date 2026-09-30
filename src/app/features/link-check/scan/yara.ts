import type { Yara } from 'libyara-wasm';
import { Scan } from './context';

const MAX_YARA_BYTES = 64 * 1024 * 1024;

let yara: Promise<Yara> | undefined;
let rules: Promise<string> | undefined;

const list = <T>(v: { size: () => number; get: (i: number) => T }): T[] =>
  Array.from({ length: v.size() }, (_, i) => v.get(i));

const TYPES: Record<string, string> = {
  Ransomware: 'ransomware',
  Backdoor: 'a backdoor that lets someone control your computer',
  Infostealer: 'a password and data stealer',
  Downloader: 'a downloader that installs more malware',
  Trojan: 'a trojan',
  Rootkit: 'a rootkit',
  Exploit: 'an exploit',
  Virus: 'a virus',
};

export const scanYara = async (scan: Scan, bytes: Uint8Array, rulesUrl: string) => {
  if (bytes.length > MAX_YARA_BYTES) return false;
  try {
    yara ??= import('libyara-wasm').then((m) => m.default());
    rules ??= fetch(rulesUrl).then((res) => {
      if (!res.ok) throw new Error('rules');
      return res.text();
    });
    const [engine, text] = await Promise.all([yara, rules]);
    const result = engine.run(bytes, text);
    if (list(result.compileErrors).some((e) => !e.warning)) throw new Error('rules');
    list(result.matchedRules).forEach(({ ruleName: rule, metadata }) => {
      const meta = Object.fromEntries(list(metadata).map((x) => [x.identifier, x.data]));
      const family = meta.tc_detection_name || meta.malware || rule;
      const type = TYPES[meta.tc_detection_type ?? ''];
      if (rule.startsWith('cert_blocklist')) {
        scan.add('bad', "It's signed with a certificate that was stolen or used to sign malware.");
      } else if (type) {
        scan.add('bad', `It matches ${family}, ${type}.`);
      } else if (meta.tc_detection_type === 'PUA') {
        scan.add('warn', `It matches ${family}, a program that's often unwanted.`);
      } else {
        scan.add('bad', `It matches the ${family} malware pattern.`);
      }
    });
    return true;
  } catch {
    yara = undefined;
    rules = undefined;
    return false;
  }
};
