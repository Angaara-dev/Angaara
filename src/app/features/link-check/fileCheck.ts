import { MatrixClient } from 'matrix-js-sdk';
import { CheckQuota, LinkFinding } from './linkCheck';

// Everything here runs on your device; only the file's SHA-256 fingerprint can leave it.
export type FileReport = {
  verdict: 'ok' | 'warn' | 'bad';
  name: string;
  size: number;
  kind?: string;
  sha256?: string;
  findings: LinkFinding[];
  // Known-malware lookup: true/false once asked, undefined if it couldn't be.
  listed?: boolean;
  listedName?: string;
  lookupNote?: string;
  quota?: CheckQuota;
};

const PROGRAM_EXT =
  /\.(exe|msi|scr|bat|cmd|com|pif|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|jar|apk|lnk|dll|sys|sh|run|app|dmg|pkg|iso|img|reg|msix|appx|cpl)$/i;
const DOCUMENT_EXT = /\.(pdf|jpe?g|png|gif|webp|docx?|xlsx?|pptx?|txt|csv|mp3|mp4|mov|zip|rar)$/i;
const MACRO_EXT = /\.(docm|xlsm|pptm|dotm|xltm|xlam)$/i;
const MAX_HASH_BYTES = 200 * 1024 * 1024;

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
  if (at([0xcf, 0xfa, 0xed, 0xfe]) || at([0xfe, 0xed, 0xfa, 0xce]) || at([0xca, 0xfe, 0xba, 0xbe]))
    return 'Mac program';
  if (ascii('#!')) return 'script';
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
  return undefined;
};
const EXPECTED: Record<string, RegExp> = {
  PDF: /\.pdf$/i,
  PNG: /\.png$/i,
  JPEG: /\.jpe?g$/i,
  GIF: /\.gif$/i,
  WebP: /\.webp$/i,
  zip: /\.(zip|docx|xlsx|pptx|docm|xlsm|pptm|jar|apk|odt|ods|epub|xpi|msix|appx)$/i,
};
const PROGRAMS = ['Windows program', 'Linux program', 'Mac program', 'script'];

// Lists a zip's files from its central directory, and whether any are password-protected.
const zipEntries = (b: Uint8Array): { names: string[]; encrypted: boolean } | undefined => {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return undefined;
  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true);
  const names: string[] = [];
  let encrypted = false;
  const decoder = new TextDecoder();
  for (let i = 0; i < count && pos + 46 <= b.length; i += 1) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    // Bit 0 of the flags marks a password-protected entry.
    // eslint-disable-next-line no-bitwise
    if (view.getUint16(pos + 8, true) & 1) encrypted = true;
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    names.push(decoder.decode(b.subarray(pos + 46, pos + 46 + nameLen)));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return { names, encrypted };
};

const hasBytes = (b: Uint8Array, text: string, utf16 = false): boolean => {
  const needle = utf16
    ? [...text].flatMap((c) => [c.charCodeAt(0), 0])
    : [...text].map((c) => c.charCodeAt(0));
  const first = needle[0];
  for (
    let i = b.indexOf(first);
    i !== -1 && i <= b.length - needle.length;
    i = b.indexOf(first, i + 1)
  ) {
    if (needle.every((v, j) => b[i + j] === v)) return true;
  }
  return false;
};

// Looks the file over locally, without opening or running it.
export const inspectFile = (name: string, bytes: Uint8Array): Omit<FileReport, 'verdict'> => {
  const findings: LinkFinding[] = [];
  const add = (level: LinkFinding['level'], text: string) => findings.push({ level, text });
  const kind = sniff(bytes);

  if (name.includes('‮')) {
    add('bad', 'The name hides its real ending with a backwards-text character.');
  }
  const parts = name.toLowerCase().split('.');
  if (
    parts.length > 2 &&
    PROGRAM_EXT.test(name) &&
    DOCUMENT_EXT.test(`.${parts[parts.length - 2]}`)
  ) {
    add('bad', `It pretends to be a .${parts[parts.length - 2]} file but ends in .${parts.pop()}.`);
  } else if (PROGRAM_EXT.test(name)) {
    add(
      'warn',
      'This is a program or script. Only open it if you trust the sender and expected it.'
    );
  }
  if (kind && PROGRAMS.includes(kind) && !PROGRAM_EXT.test(name)) {
    add('bad', `It's named like a normal file, but it's really a ${kind}.`);
  } else if (kind && EXPECTED[kind] && !EXPECTED[kind].test(name) && !PROGRAMS.includes(kind)) {
    add('warn', `It's really a ${kind} file, which doesn't match its name.`);
  }

  if (kind === 'zip') {
    const zip = zipEntries(bytes);
    if (zip?.encrypted) {
      add('warn', "It's a password-protected archive, which scanners can't look inside.");
    }
    if (zip?.names.some((n) => /(^|\/)vbaProject\.bin$/i.test(n))) {
      add('bad', 'This Office document contains macros, code that runs when it opens.');
    }
    const programs = zip?.names.filter((n) => PROGRAM_EXT.test(n)) ?? [];
    if (programs.length > 0 && !/\.(jar|apk|msix|appx)$/i.test(name)) {
      add('warn', `The archive contains programs or scripts: ${programs.slice(0, 3).join(', ')}.`);
    }
  }
  if (kind === 'old Office file' && hasBytes(bytes, '_VBA_PROJECT', true)) {
    add('bad', 'This Office document contains macros, code that runs when it opens.');
  } else if (MACRO_EXT.test(name)) {
    add('warn', 'This file type can contain macros.');
  }
  if (
    kind === 'PDF' &&
    /\/(JavaScript|JS|Launch|OpenAction)\b/.test(new TextDecoder('latin1').decode(bytes))
  ) {
    add('warn', 'This PDF has actions or scripts that run when it opens.');
  }
  if (/\.(svg|html?|xhtml|mht)$/i.test(name)) {
    const text = new TextDecoder().decode(bytes.subarray(0, 2 * 1024 * 1024));
    if (/<script|\son[a-z]+\s*=|javascript:/i.test(text)) {
      add('bad', 'It carries scripts that run if you open it in a browser.');
    }
  }
  return { name, size: bytes.length, kind, findings };
};

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

// Checks a file locally, then (unless told not to) looks up its fingerprint.
export const checkFile = async (
  mx: MatrixClient,
  name: string,
  blob: Blob,
  lookup: boolean
): Promise<FileReport> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const report: FileReport = { verdict: 'ok', ...inspectFile(name, bytes) };
  if (bytes.length <= MAX_HASH_BYTES) {
    report.sha256 = hex(await crypto.subtle.digest('SHA-256', bytes));
  }
  if (lookup && report.sha256) {
    try {
      const res = await fetch(`${window.location.origin}/api/links/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openid: await mx.getOpenIdToken(), sha256: report.sha256 }),
      });
      const data = await res.json().catch(() => undefined);
      if (!res.ok) throw new Error(data?.error ?? "The known-malware list couldn't be checked.");
      report.listed = data.listed;
      report.listedName = data.name;
      report.quota = data.quota;
      if (data.listed) {
        report.findings.unshift({
          level: 'bad',
          text: `It's known malware${data.name ? ` (${data.name})` : ''}, listed on MalwareBazaar.`,
        });
      }
    } catch (e) {
      report.lookupNote =
        e instanceof Error ? e.message : "The known-malware list couldn't be checked.";
    }
  }
  if (report.findings.some((f) => f.level === 'warn')) report.verdict = 'warn';
  if (report.findings.some((f) => f.level === 'bad')) report.verdict = 'bad';
  return report;
};
