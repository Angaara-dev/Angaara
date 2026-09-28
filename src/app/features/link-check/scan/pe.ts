import { entropy, latin1, utf16, view } from './bytes';
import { Scan } from './context';
import { scanScript } from './script';

type Section = {
  name: string;
  va: number;
  vsize: number;
  raw: number;
  rawSize: number;
  exec: boolean;
};

const PACKERS: [RegExp, string][] = [
  [/^UPX\d?$/, 'UPX'],
  [/^\.aspack$/i, 'ASPack'],
  [/^\.MPRESS\d$/, 'MPRESS'],
  [/^\.themida$|^\.winlice$/i, 'Themida'],
  [/^\.vmp\d$/, 'VMProtect'],
  [/^\.enigma\d$/, 'Enigma'],
  [/^\.petite$/, 'Petite'],
  [/^nsp\d$/, 'NsPack'],
];

type Ability = { needs: string[][]; does: string; level?: 'warn' | 'bad' };

// Windows features that, together, point at what a program can do. Each inner list needs one hit.
const ABILITIES: Ability[] = [
  {
    needs: [
      ['VirtualAllocEx', 'NtAllocateVirtualMemory'],
      ['WriteProcessMemory', 'NtWriteVirtualMemory'],
      ['CreateRemoteThread', 'NtCreateThreadEx', 'QueueUserAPC', 'SetThreadContext'],
    ],
    does: 'Can inject its code into other running programs.',
    level: 'bad',
  },
  {
    needs: [['NtUnmapViewOfSection', 'ZwUnmapViewOfSection'], ['SetThreadContext']],
    does: 'Can hollow out another program and run inside it.',
    level: 'bad',
  },
  {
    needs: [
      ['SetWindowsHookExA', 'SetWindowsHookExW'],
      ['GetAsyncKeyState', 'GetKeyboardState', 'GetKeyState', 'CallNextHookEx'],
      ['GetForegroundWindow', 'GetWindowTextA', 'GetWindowTextW'],
    ],
    does: 'Can record the keys you press.',
    level: 'warn',
  },
  {
    needs: [['GetClipboardData'], ['SetClipboardData']],
    does: 'Can read and change what you copy.',
  },
  {
    needs: [
      [
        'URLDownloadToFileA',
        'URLDownloadToFileW',
        'InternetOpenUrlA',
        'InternetOpenUrlW',
        'InternetReadFile',
        'WinHttpOpen',
        'HttpSendRequestA',
        'HttpSendRequestW',
        'DownloadString',
        'DownloadFile',
        'HttpClient',
      ],
    ],
    does: 'Can connect to the internet and download files.',
  },
  {
    needs: [['CreateServiceA', 'CreateServiceW']],
    does: 'Can install itself as a background service.',
  },
  {
    needs: [
      ['IsDebuggerPresent', 'CheckRemoteDebuggerPresent'],
      ['GetTickCount', 'QueryPerformanceCounter'],
      ['NtQueryInformationProcess'],
    ],
    does: 'Checks whether it is being watched or analysed.',
  },
];

// Strings a normal program has no reason to carry; checked with the script rules.
const STRING_HINTS =
  /vssadmin|wbadmin|bcdedit|Set-MpPreference|Add-MpPreference|DisableRealtimeMonitoring|\/api\/webhooks\/|api\.telegram\.org\/bot|powershell[^\n]{0,40}-e(nc)?\s|CurrentVersion\\Run/i;

const strings = (b: Uint8Array): string[] => {
  const sample = b.subarray(0, 32 * 1024 * 1024);
  const wide = utf16(sample.subarray(0, sample.length - (sample.length % 2)));
  return [
    ...(latin1(sample).match(/[\x20-\x7e]{6,}/g) ?? []),
    ...(wide.match(/[\x20-\x7e]{6,}/g) ?? []),
  ];
};

// Looks inside a Windows program without running it: signature, packing and what it can do.
export const scanPe = (scan: Scan, b: Uint8Array): void => {
  const v = view(b);
  const pe = v.getUint32(0x3c, true);
  if (pe + 24 > b.length || v.getUint32(pe, true) !== 0x4550) return;
  const count = v.getUint16(pe + 6, true);
  // eslint-disable-next-line no-bitwise
  const dll = (v.getUint16(pe + 22, true) & 0x2000) !== 0;
  const optSize = v.getUint16(pe + 20, true);
  const opt = pe + 24;
  const plus = v.getUint16(opt, true) === 0x20b;
  const dirs = opt + (plus ? 112 : 96);
  const dir = (i: number) => ({
    at: v.getUint32(dirs + i * 8, true),
    size: v.getUint32(dirs + i * 8 + 4, true),
  });

  const sections: Section[] = [];
  for (let i = 0, at = opt + optSize; i < count && at + 40 <= b.length; i += 1, at += 40) {
    sections.push({
      name: latin1(b.subarray(at, at + 8)).replace(/\0.*$/, ''),
      vsize: v.getUint32(at + 8, true),
      va: v.getUint32(at + 12, true),
      rawSize: v.getUint32(at + 16, true),
      raw: v.getUint32(at + 20, true),
      // eslint-disable-next-line no-bitwise
      exec: (v.getUint32(at + 36, true) & 0x20000000) !== 0,
    });
  }
  const offset = (rva: number) => {
    const s = sections.find((x) => rva >= x.va && rva < x.va + Math.max(x.vsize, x.rawSize));
    return s ? rva - s.va + s.raw : -1;
  };
  const cstr = (at: number) => (at < 0 ? '' : latin1(b.subarray(at, at + 256)).split('\0')[0]);

  // Imported functions, by name.
  const imports: string[] = [];
  const dlls: string[] = [];
  const imp = dir(1);
  let desc = offset(imp.at);
  for (let n = 0; imp.size > 0 && desc >= 0 && desc + 20 <= b.length && n < 512; n += 1) {
    const thunks = v.getUint32(desc, true) || v.getUint32(desc + 16, true);
    const name = v.getUint32(desc + 12, true);
    if (!thunks && !name) break;
    dlls.push(cstr(offset(name)).toLowerCase());
    let t = offset(thunks);
    for (let k = 0; t >= 0 && t + 8 <= b.length && k < 4096; k += 1) {
      const high = plus ? v.getUint32(t + 4, true) : v.getUint32(t, true);
      const low = v.getUint32(t, true);
      if (!low && !high) break;
      // eslint-disable-next-line no-bitwise
      const byOrdinal = plus ? (high & 0x80000000) !== 0 : (low & 0x80000000) !== 0;
      if (!byOrdinal) imports.push(cstr(offset(low) + 2));
      t += plus ? 8 : 4;
    }
    desc += 20;
  }

  const dotnet = dir(14).size > 0;
  if (dotnet) scan.does('Is a .NET program.');
  const text = strings(b);
  const names = new Set(dotnet ? text : imports);

  if (dir(4).size === 0) {
    scan.add('warn', "It isn't digitally signed, so there's no telling who made it.");
  } else {
    scan.does("Has a digital signature (Angaara can't check that it's genuine).");
  }

  const packer = sections.map((s) => PACKERS.find(([re]) => re.test(s.name))?.[1]).find(Boolean);
  const packed = sections.some(
    (s) =>
      s.exec &&
      s.rawSize > 4096 &&
      s.raw + s.rawSize <= b.length &&
      entropy(b.subarray(s.raw, s.raw + s.rawSize)) > 7.2
  );
  if (packer) scan.add('warn', `It's packed with ${packer}, which hides its real code.`);
  else if (packed)
    scan.add('warn', 'Its code is compressed or encrypted, which hides what it does.');
  if (!dotnet && !dll && imports.length > 0 && imports.length < 8) {
    const loads = imports.some((f) => /^(LoadLibrary|GetProcAddress)/.test(f));
    if (loads) scan.add('warn', 'It hides which Windows features it uses until it runs.');
  }

  ABILITIES.forEach((a) => {
    if (a.needs.every((any) => any.some((f) => names.has(f)))) {
      scan.does(a.does);
      if (a.level) scan.add(a.level, a.does);
    }
  });
  const hints = text.filter((s) => STRING_HINTS.test(s));
  if (hints.length > 0) scanScript(scan, hints.join('\n'));
};
