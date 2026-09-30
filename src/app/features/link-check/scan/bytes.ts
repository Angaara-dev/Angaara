export const latin1 = (b: Uint8Array, max = b.length): string =>
  new TextDecoder('latin1').decode(b.subarray(0, max));

export const utf8 = (b: Uint8Array, max = b.length): string =>
  new TextDecoder().decode(b.subarray(0, max));

export const utf16 = (b: Uint8Array): string => new TextDecoder('utf-16le').decode(b);

export const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

export const hasBytes = (b: Uint8Array, text: string, wide = false): boolean => {
  const needle = wide
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

// Shannon entropy in bits per byte; packed or encrypted data sits close to 8.
export const entropy = (b: Uint8Array): number => {
  if (b.length === 0) return 0;
  const counts = new Array<number>(256).fill(0);
  b.forEach((v) => {
    counts[v] += 1;
  });
  return counts.reduce((sum, c) => {
    if (c === 0) return sum;
    const p = c / b.length;
    return sum - p * Math.log2(p);
  }, 0);
};

export const isText = (b: Uint8Array): boolean => {
  const sample = b.subarray(0, 4096);
  if (sample.length === 0) return false;
  let odd = 0;
  sample.forEach((v) => {
    if (v < 9 || (v > 13 && v < 32)) odd += 1;
  });
  return odd / sample.length < 0.02;
};

// Addresses that show up in every document's markup, not links anyone would open.
const BORING_HOSTS =
  /(^|\.)(w3\.org|openxmlformats\.org|schemas\.microsoft\.com|purl\.org|ns\.adobe\.com|openoffice\.org|oasis-open\.org|xml\.org|localhost)$/i;

export const findLinks = (text: string): string[] => {
  const out: string[] = [];
  (text.match(/https?:\/\/[^\s"'<>()\\^`{|}\]]{3,2000}/gi) ?? []).forEach((raw) => {
    const url = raw.replace(/[.,;:!?'")\]]+$/, '');
    try {
      const { hostname } = new URL(url);
      if (!BORING_HOSTS.test(hostname) && !out.includes(url)) out.push(url);
    } catch {
      // Not a real address.
    }
  });
  return out;
};
