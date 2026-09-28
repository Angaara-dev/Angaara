import { findLinks, hasBytes, isText, latin1, utf16, utf8 } from './bytes';
import { createScan, Scan, ScanResult } from './context';
import { isIso, isoFiles } from './iso';
import { isLnk, scanLnk } from './lnk';
import { scanOffice } from './office';
import { scanPe } from './pe';
import { scanPage, scanScript, SCRIPT_EXT } from './script';
import { scanYara } from './yara';
import { readEntry, zipEntries } from './zip';

const PROGRAM_EXT =
  /\.(exe|msi|msp|scr|bat|cmd|com|pif|ps1|psm1|vbs|vbe|js|jse|ws|wsf|wsh|hta|jar|apk|lnk|dll|so|dylib|sys|sh|run|app|command|desktop|dmg|pkg|iso|img|reg|msix|appx|cpl|xll|scpt|gadget|inf)$/i;
const RISKY_EXT =
  /\.(one|chm|vhdx?|url|iqy|slk|library-ms|settingcontent-ms|appref-ms|application|jnlp)$/i;
const DOCUMENT_EXT = /\.(pdf|jpe?g|png|gif|webp|docx?|xlsx?|pptx?|txt|csv|mp3|mp4|mov|zip|rar)$/i;
const MACRO_EXT = /\.(docm|xlsm|pptm|dotm|xltm|xlam)$/i;
const PAGE_EXT = /\.(svg|html?|xhtml|mht|shtml)$/i;
const MAX_HASH_BYTES = 200 * 1024 * 1024;
const MAX_INNER = 5;

// What the first bytes say the file really is.
const sniff = (b: Uint8Array): string | undefined => {
  const at = (sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);
  const ascii = (s: string, off = 0) =>
    at(
      [...s].map((c) => c.charCodeAt(0)),
      off
    );
  if (ascii('MZ')) return 'Windows program';
  if (at([0x7f, 0x45, 0x4c, 0x46])) return 'Linux program';
  if (
    [
      [0xcf, 0xfa, 0xed, 0xfe],
      [0xce, 0xfa, 0xed, 0xfe],
      [0xfe, 0xed, 0xfa, 0xce],
      [0xfe, 0xed, 0xfa, 0xcf],
      [0xca, 0xfe, 0xba, 0xbe],
    ].some((sig) => at(sig))
  )
    return 'Mac program';
  if (ascii('#!')) return 'script';
  if (isLnk(b)) return 'Windows shortcut';
  if (ascii('%PDF')) return 'PDF';
  if (at([0x50, 0x4b, 0x03, 0x04])) return 'zip';
  if (ascii('Rar!')) return 'rar';
  if (at([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return '7z';
  if (at([0xd0, 0xcf, 0x11, 0xe0])) return 'old Office file';
  if (at([0x89, 0x50, 0x4e, 0x47])) return 'PNG';
  if (at([0xff, 0xd8, 0xff])) return 'JPEG';
  if (ascii('GIF8')) return 'GIF';
  if (ascii('RIFF') && ascii('WEBP', 8)) return 'WebP';
  if (ascii('ftyp', 4)) return 'video';
  if (isIso(b)) return 'disc image';
  return undefined;
};
const EXPECTED: Record<string, RegExp> = {
  PDF: /\.pdf$/i,
  PNG: /\.png$/i,
  JPEG: /\.jpe?g$/i,
  GIF: /\.gif$/i,
  WebP: /\.webp$/i,
  zip: /\.(zip|docx|xlsx|pptx|docm|xlsm|pptm|jar|apk|odt|ods|epub|xpi|msix|appx)$/i,
  'disc image': /\.(iso|img)$/i,
};
const PROGRAMS = ['Windows program', 'Linux program', 'Mac program', 'script', 'Windows shortcut'];
const OFFICE = /^(\[Content_Types\]\.xml|word\/|xl\/|ppt\/)/;

// Reads a script's text, including the UTF-16 files Windows tools like to write.
const scriptText = (b: Uint8Array) =>
  b[0] === 0xff && b[1] === 0xfe
    ? utf16(b.subarray(2, 2 + 4 * 1024 * 1024))
    : utf8(b, 4 * 1024 * 1024);

const checkName = (scan: Scan, name: string, kind: string | undefined) => {
  if (name.includes('‮')) {
    scan.add('bad', 'The name hides its real ending with a backwards-text character.');
  }
  const parts = name.toLowerCase().split('.');
  if (
    parts.length > 2 &&
    PROGRAM_EXT.test(name) &&
    DOCUMENT_EXT.test(`.${parts[parts.length - 2]}`)
  ) {
    scan.add(
      'bad',
      `It pretends to be a .${parts[parts.length - 2]} file but ends in .${parts.pop()}.`
    );
  } else if (PROGRAM_EXT.test(name)) {
    scan.add(
      'warn',
      'This is a program or script. Only open it if you trust the sender and expected it.'
    );
  } else if (RISKY_EXT.test(name)) {
    scan.add('warn', 'This type of file is often used to sneak in malware.');
  }
  if (kind && PROGRAMS.includes(kind) && !PROGRAM_EXT.test(name)) {
    scan.add('bad', `It's named like a normal file, but it's really a ${kind}.`);
  } else if (kind && EXPECTED[kind] && !EXPECTED[kind].test(name) && !PROGRAMS.includes(kind)) {
    scan.add('warn', `It's really a ${kind} file, which doesn't match its name.`);
  }
};

const worthOpening = (name: string) =>
  PROGRAM_EXT.test(name) || SCRIPT_EXT.test(name) || PAGE_EXT.test(name) || RISKY_EXT.test(name);

// Looks a file over without opening or running it, and one level into archives.
const inspect = async (
  scan: Scan,
  name: string,
  b: Uint8Array,
  depth: number
): Promise<string | undefined> => {
  const kind = sniff(b);
  checkName(scan, name, kind);

  const inner: { name: string; read: () => Promise<Uint8Array | undefined> }[] = [];
  if (kind === 'zip') {
    const entries = zipEntries(b) ?? [];
    if (entries.some((e) => e.encrypted)) {
      scan.add('warn', "It's a password-protected archive, which scanners can't look inside.");
    }
    if (entries.some((e) => OFFICE.test(e.name))) {
      await scanOffice(scan, b, entries);
    } else if (!/\.(jar|apk|msix|appx|xpi)$/i.test(name)) {
      const programs = entries.filter((e) => PROGRAM_EXT.test(e.name)).map((e) => e.name);
      if (programs.length > 0) {
        scan.add(
          'warn',
          `The archive contains programs or scripts: ${programs.slice(0, 3).join(', ')}.`
        );
      }
      entries
        .filter((e) => worthOpening(e.name))
        .forEach((e) => inner.push({ name: e.name, read: () => readEntry(b, e) }));
    }
  }
  if (kind === 'disc image') {
    const files = isoFiles(b);
    const programs = files.filter((f) => PROGRAM_EXT.test(f.name)).map((f) => f.name);
    if (programs.length > 0) {
      scan.add(
        'bad',
        `The disc image hides programs or scripts: ${programs.slice(0, 3).join(', ')}.`
      );
    }
    files
      .filter((f) => worthOpening(f.name))
      .forEach((f) => inner.push({ name: f.name, read: async () => f.data }));
  }
  if (depth === 0) {
    // One level into archives and disc images, where most malware sent in chats hides.
    // eslint-disable-next-line no-restricted-syntax
    for (const file of inner.slice(0, MAX_INNER)) {
      // eslint-disable-next-line no-await-in-loop
      const data = await file.read();
      // eslint-disable-next-line no-await-in-loop
      if (data) await inspect(scan, file.name, data, depth + 1);
    }
  }

  if (kind === 'old Office file' && hasBytes(b, '_VBA_PROJECT', true)) {
    scan.add('bad', 'This Office document contains macros, code that runs when it opens.');
    scan.does('Runs macros when opened.');
  } else if (MACRO_EXT.test(name)) {
    scan.add('warn', 'This file type can contain macros.');
  }
  if (kind === 'PDF') {
    const text = latin1(b, 32 * 1024 * 1024);
    if (/\/Launch\b/.test(text)) {
      scan.add('bad', 'This PDF can start programs on your computer.');
      scan.does('Tries to start a program when opened.');
    } else if (/\/(JavaScript|JS)\b/.test(text)) {
      scan.add('warn', 'This PDF has scripts that run when it opens.');
      scan.does('Runs scripts when opened.');
    } else if (/\/OpenAction\b/.test(text)) {
      scan.does('Does something automatically when opened.');
    }
    if (/\/EmbeddedFile\b/.test(text)) scan.does('Has other files embedded inside it.');
    Array.from(text.matchAll(/\/URI\s*\(([^)]{4,2000})\)/g)).forEach((m) =>
      findLinks(m[1]).forEach(scan.link)
    );
  }
  if (PAGE_EXT.test(name)) scanPage(scan, utf8(b, 4 * 1024 * 1024));
  if (kind === 'Windows shortcut') scanLnk(scan, b);
  if (/\.url$/i.test(name)) {
    const target = /^URL=(.+)$/im.exec(utf8(b, 64 * 1024))?.[1]?.trim();
    if (target && /^(file:|\\\\)/i.test(target)) {
      scan.add('bad', 'It opens a file from another computer over the network.');
    }
    if (target) findLinks(target).forEach(scan.link);
  }
  if (
    kind === 'script' ||
    (SCRIPT_EXT.test(name) && (isText(b) || (b[0] === 0xff && b[1] === 0xfe)))
  ) {
    scanScript(scan, scriptText(b));
  }
  if (kind === 'Windows program') {
    try {
      scanPe(scan, b);
    } catch {
      scan.add('warn', "It's a damaged or unusual Windows program, so it couldn't be read fully.");
    }
  }
  return kind;
};

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

export type LocalScan = ScanResult & {
  size: number;
  kind?: string;
  sha256?: string;
  // Whether the malware rules ran on this file.
  yara: boolean;
};

// The whole on-device check. Runs in a worker, so big files never freeze the app.
export const scanBytes = async (
  name: string,
  bytes: Uint8Array,
  rulesUrl: string
): Promise<LocalScan> => {
  const scan = createScan();
  const kind = await inspect(scan, name, bytes, 0);
  const sha256 =
    bytes.length <= MAX_HASH_BYTES ? hex(await crypto.subtle.digest('SHA-256', bytes)) : undefined;
  const yara = await scanYara(scan, bytes, rulesUrl).catch(() => false);
  return {
    size: bytes.length,
    kind,
    sha256,
    yara,
    findings: scan.findings,
    behaviors: scan.behaviors,
    commands: scan.commands,
    links: scan.links,
  };
};
