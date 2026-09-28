import { trimTrailingSlash } from '../../../utils/common';
import { Scan } from './context';
import type { YaraMatch } from './yara.worker';

const MAX_YARA_BYTES = 64 * 1024 * 1024;
const TIMEOUT = 60 * 1000;

let worker: Worker | undefined;
let nextId = 0;

const runYara = (bytes: Uint8Array): Promise<YaraMatch[] | undefined> =>
  new Promise((resolve) => {
    worker ??= new Worker(new URL('./yara.worker.ts', import.meta.url), { type: 'module' });
    const w = worker;
    nextId += 1;
    const id = nextId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMessage = (evt: MessageEvent<{ id: number; matches?: YaraMatch[] }>) => {
      if (evt.data.id !== id) return;
      clearTimeout(timer);
      w.removeEventListener('message', onMessage);
      resolve(evt.data.matches);
    };
    timer = setTimeout(() => {
      // A stuck scan gets a fresh worker next time.
      w.removeEventListener('message', onMessage);
      w.terminate();
      if (worker === w) worker = undefined;
      resolve(undefined);
    }, TIMEOUT);
    w.addEventListener('message', onMessage);
    w.postMessage({
      id,
      bytes,
      rulesUrl: `${trimTrailingSlash(import.meta.env.BASE_URL)}/yara/reversinglabs.yar`,
    });
  });

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

// Matches the file against ReversingLabs' malware rules, all on this device.
export const scanYara = async (scan: Scan, bytes: Uint8Array): Promise<boolean> => {
  if (bytes.length > MAX_YARA_BYTES || typeof Worker === 'undefined') return false;
  const matches = await runYara(bytes);
  if (!matches) return false;
  matches.forEach(({ rule, meta }) => {
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
};
