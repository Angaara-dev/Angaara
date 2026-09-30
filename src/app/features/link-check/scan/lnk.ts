import { latin1, utf16, view } from './bytes';
import { Scan } from './context';
import { scanScript } from './script';

const LNK_CLSID = [0x01, 0x14, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0, 0, 0, 0, 0, 0, 0x46];
export const isLnk = (b: Uint8Array) =>
  b.length > 0x4c && b[0] === 0x4c && LNK_CLSID.every((v, i) => b[4 + i] === v);

const RUNNERS =
  /\\?(cmd|powershell|pwsh|mshta|wscript|cscript|rundll32|regsvr32|msiexec|conhost|forfiles|curl|bitsadmin|certutil|wmic|schtasks|bash|python\w*)(\.exe)?$/i;

const cString = (s: string) => s.split('\0')[0];

// Readable names inside the target's shell item list, used when the link has no plain path.
const guessTarget = (b: Uint8Array): string | undefined => {
  const runs = [
    ...(latin1(b).match(/[\x20-\x7e]{4,}/g) ?? []),
    ...(utf16(b.subarray(0, b.length - (b.length % 2))).match(/[\x20-\x7e]{4,}/g) ?? []),
  ];
  return runs.reverse().find((s) => /\.(exe|dll|bat|cmd|ps1|vbs|js|hta|msi|lnk)$/i.test(s));
};

// Reads a Windows shortcut and shows the command it would really run (MS-SHLLINK).
export const scanLnk = (scan: Scan, b: Uint8Array): void => {
  const v = view(b);
  const flags = v.getUint32(0x14, true);
  // eslint-disable-next-line no-bitwise
  const has = (bit: number) => (flags & bit) !== 0;
  const showCommand = v.getUint32(0x3c, true);
  let pos = 0x4c;
  let target: string | undefined;
  try {
    if (has(0x1)) {
      const size = v.getUint16(pos, true);
      target = guessTarget(b.subarray(pos + 2, pos + 2 + size));
      pos += 2 + size;
    }
    if (has(0x2)) {
      const size = v.getUint32(pos, true);
      const headerSize = v.getUint32(pos + 4, true);
      const infoFlags = v.getUint32(pos + 8, true);
      // eslint-disable-next-line no-bitwise
      if (infoFlags & 1) {
        const at = headerSize >= 0x24 ? v.getUint32(pos + 0x1c, true) : 0;
        target =
          at > 0
            ? cString(utf16(b.subarray(pos + at, pos + size)))
            : cString(latin1(b.subarray(pos + v.getUint32(pos + 0x10, true), pos + size)));
      }
      pos += size;
    }
    const strings: string[] = [];
    [0x4, 0x8, 0x10, 0x20, 0x40].forEach((bit) => {
      if (!has(bit)) {
        strings.push('');
        return;
      }
      const count = v.getUint16(pos, true);
      const len = has(0x80) ? count * 2 : count;
      const raw = b.subarray(pos + 2, pos + 2 + len);
      strings.push(has(0x80) ? utf16(raw) : latin1(raw));
      pos += 2 + len;
    });
    const [, relative, , args, icon] = strings;
    // An environment-variable target, like %windir%\system32\cmd.exe.
    for (let at = pos; at + 8 <= b.length; ) {
      const size = v.getUint32(at, true);
      if (size < 8) break;
      if (v.getUint32(at + 4, true) === 0xa0000001 && at + 788 <= b.length) {
        target = cString(utf16(b.subarray(at + 268, at + 788))) || target;
      }
      at += size;
    }
    target = target || relative || undefined;
    // Padding is squeezed for display; the long-blank check below reads the original.
    const line = [target, args]
      .filter(Boolean)
      .join(' ')
      .replace(/\s{2,}/g, ' ');

    scan.add('warn', "It's a shortcut that runs something, not a document.");
    if (line) {
      scan.does(`Runs ${line.length > 100 ? `${line.slice(0, 100)}…` : line}`);
      scan.command(line);
      scanScript(scan, line);
    }
    if (target && RUNNERS.test(target.trim())) {
      const tool = target.trim().split(/[\\/]/).pop();
      scan.add('bad', `This shortcut starts ${tool} with a command instead of opening a file.`);
    }
    if (args && /\s{60,}/.test(args)) {
      scan.add('bad', 'It hides its command after a long run of blank space.');
    }
    if (showCommand === 7) scan.does('Opens minimized, so you might not notice it.');
    if (icon && /\.(pdf|docx?|xlsx?|jpe?g|png|txt)$|shell32|imageres|msedge|chrome/i.test(icon)) {
      scan.add('warn', 'It borrows an icon to look like a normal file.');
    }
  } catch {
    scan.add('warn', "It's a shortcut, but it's damaged or unusual, so it couldn't be read.");
  }
};
