import { findLinks } from './bytes';
import { Scan } from './context';

type Rule = { test: RegExp; does: string; level?: 'warn' | 'bad' };

// Common moves in malicious scripts, in plain language. Order is how they're listed.
const RULES: Rule[] = [
  {
    test: /DownloadString|DownloadFile|DownloadData|Invoke-WebRequest|\biwr\s|Invoke-RestMethod|\birm\s|Net\.WebClient|Start-BitsTransfer|bitsadmin[^\n]*\/transfer|certutil[^\n]*-urlcache|\b(curl|wget)(\.exe)?\s+[^\n]*https?:|XMLHTTP|WinHttpRequest|URLDownloadToFile/i,
    does: 'Downloads files from the internet.',
  },
  {
    test: /\bIEX\b|Invoke-Expression|\beval\s*\(|ExecuteGlobal|\bExecute\s*\(|new\s+Function\s*\(|FromBase64String|\batob\s*\(/i,
    does: 'Runs code that is hidden or built while it runs.',
  },
  {
    test: /-w(indowstyle)?\s+h(idden)?\b|CreateNoWindow|\.Run\s*\([^\n]*,\s*0\s*[,)]|-noni(nteractive)?\b/i,
    does: 'Runs commands in a hidden window.',
  },
  {
    test: /ExecutionPolicy\s+Bypass|-ep\s+bypass|-exec\s+bypass|-nop(rofile)?\b/i,
    does: "Turns off PowerShell's safety checks.",
  },
  {
    test: /\bpowershell|\bpwsh\b|\bcmd(\.exe)?\s+\/[ck]\b|WScript\.Shell|Shell\.Application|ShellExecute|\bmshta\b|\brundll32\b|\bregsvr32\b|wmic[^\n]*process|Start-Process|child_process|os\.system|subprocess\.|do shell script/i,
    does: 'Starts other programs or commands.',
  },
  {
    test: /CurrentVersion\\+Run|\bschtasks\b|Register-ScheduledTask|New-ScheduledTask|\\Start Menu\\Programs\\Startup|crontab|LaunchAgents|LaunchDaemons|systemctl\s+enable/i,
    does: 'Sets itself to start automatically.',
    level: 'warn',
  },
  {
    test: /Set-MpPreference|Add-MpPreference|DisableRealtimeMonitoring|ExclusionPath|AmsiUtils|amsiInitFailed/i,
    does: 'Tries to switch off or get past the antivirus.',
    level: 'bad',
  },
  {
    test: /vssadmin[^\n]*delete|wbadmin[^\n]*delete|bcdedit[^\n]*recoveryenabled|shadowcopy[^\n]*delete/i,
    does: 'Deletes system backups, like ransomware does.',
    level: 'bad',
  },
  {
    test: /Login Data|Local Storage\\+leveldb|Network\\+Cookies|Local State|\\Telegram Desktop\\|wallet\.dat|Exodus\\|Metamask/i,
    does: 'Reads saved passwords, cookies or app sign-ins.',
    level: 'bad',
  },
  {
    test: /\/api\/webhooks\/\d+|api\.telegram\.org\/bot/i,
    does: 'Sends data to a chat-app webhook or bot.',
    level: 'bad',
  },
  {
    test: /String\.fromCharCode\s*\((\s*\d+\s*,){8}|(\[char\]\s*\d+\s*\+?\s*){6}|(chr\w?\(\d+\)\s*&\s*){6}|-bxor\s|(\^[a-z]){6}/i,
    does: 'Scrambles its own code to hide what it does.',
    level: 'warn',
  },
];

const printable = (s: string) =>
  s.length > 0 &&
  Array.from(s).every((c) => {
    const code = c.charCodeAt(0);
    return code > 31 || (code > 8 && code < 14);
  });

const fromBase64 = (b64: string): string | undefined => {
  try {
    const raw = atob(b64);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    // PowerShell's -EncodedCommand is UTF-16.
    const wide = bytes.length > 3 && bytes[1] === 0 && bytes[3] === 0;
    const text = new TextDecoder(wide ? 'utf-16le' : 'utf-8').decode(bytes);
    return printable(text) ? text : undefined;
  } catch {
    return undefined;
  }
};

const ENCODED =
  /(?:-e(?:nc(?:odedcommand)?)?\s+|FromBase64String\s*\(\s*['"]|\batob\s*\(\s*['"])([A-Za-z0-9+/=]{24,})/gi;

export const scanScript = (scan: Scan, text: string, depth = 0): void => {
  const hits = RULES.filter((r) => r.test.test(text));
  hits.forEach((r) => {
    scan.does(r.does);
    if (r.level) scan.add(r.level, r.does);
  });
  const downloads = hits.includes(RULES[0]);
  const runs = hits.includes(RULES[1]) || hits.includes(RULES[4]);
  if (downloads && runs) scan.add('bad', 'It downloads something from the internet and runs it.');
  else if (downloads || runs) scan.add('warn', 'It runs commands on your computer.');

  findLinks(text).forEach(scan.link);
  if (depth >= 2) return;
  Array.from(text.matchAll(ENCODED)).forEach((m) => {
    const decoded = fromBase64(m[1]);
    if (!decoded) return;
    scan.add('warn', 'It hides part of its code with base64 encoding.');
    scan.command(decoded);
    scanScript(scan, decoded, depth + 1);
  });
};

export const SCRIPT_EXT =
  /\.(ps1|psm1|psd1|bat|cmd|vbs|vbe|js|jse|wsf|wsh|hta|sh|bash|zsh|command|py|applescript|scpt)$/i;

export const scanPage = (scan: Scan, text: string): void => {
  if (/<script|\son[a-z]+\s*=|javascript:/i.test(text)) {
    scan.add('bad', 'It carries scripts that run if you open it in a browser.');
  }
  if (
    /new\s+Blob|createObjectURL|msSaveOrOpenBlob/i.test(text) &&
    /\.download\s*=|\sdownload\s*=|\.click\s*\(/i.test(text)
  ) {
    scan.does('Builds a file inside your browser and downloads it.');
    scan.add('bad', 'It sneaks a download past scanners by building it in your browser.');
  }
  if (/<input[^>]+type\s*=\s*["']?password/i.test(text)) {
    scan.does('Shows a sign-in form that asks for a password.');
    scan.add('bad', "It's a sign-in page. Never type your password into a file someone sent.");
  }
  if (/http-equiv\s*=\s*["']?refresh|(window|document)\.location(\.href)?\s*=/i.test(text)) {
    scan.does('Sends you to another website when opened.');
  }
  const scripts = Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))
    .map((m) => m[1])
    .join('\n');
  if (scripts) scanScript(scan, scripts);
  findLinks(text).forEach(scan.link);
};
