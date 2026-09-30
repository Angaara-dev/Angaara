import { LinkFinding } from '../linkCheck';

export type ScanResult = {
  findings: LinkFinding[];
  behaviors: string[];
  commands: string[];
  links: string[];
};

export type Scan = ScanResult & {
  add: (level: LinkFinding['level'], text: string) => void;
  does: (text: string) => void;
  command: (text: string) => void;
  link: (url: string) => void;
};

const MAX_ITEMS = 20;

export const createScan = (): Scan => {
  const scan: Scan = {
    findings: [],
    behaviors: [],
    commands: [],
    links: [],
    add: (level, text) => {
      if (!scan.findings.some((f) => f.text === text)) scan.findings.push({ level, text });
    },
    does: (text) => {
      if (!scan.behaviors.includes(text)) scan.behaviors.push(text);
    },
    command: (text) => {
      const clean = text.trim().slice(0, 600);
      if (clean && !scan.commands.includes(clean) && scan.commands.length < MAX_ITEMS) {
        scan.commands.push(clean);
      }
    },
    link: (url) => {
      if (!scan.links.includes(url) && scan.links.length < MAX_ITEMS) scan.links.push(url);
    },
  };
  return scan;
};

export const aKind = (kind: string) => `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind}`;
