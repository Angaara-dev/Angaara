import { hasBytes } from './bytes';
import { Scan } from './context';
import { readEntry, readText, ZipEntry } from './zip';

const HIDDEN_PROGRAM = /\.(exe|scr|bat|cmd|vbs|js|jse|hta|ps1|lnk|dll|msi)\b/i;

export const scanOffice = async (scan: Scan, b: Uint8Array, entries: ZipEntry[]) => {
  if (entries.some((e) => /(^|\/)vbaProject\.bin$/i.test(e.name))) {
    scan.add('bad', 'This Office document contains macros, code that runs when it opens.');
    scan.does('Runs macros when opened.');
  }
  if (entries.some((e) => /^xl\/macrosheets\//i.test(e.name))) {
    scan.add('bad', 'It has old-style Excel 4 macros, code that runs when it opens.');
    scan.does('Runs Excel 4 macros when opened.');
  }

  const rels = entries.filter((e) => /\.rels$/i.test(e.name)).slice(0, 40);
  const texts = await Promise.all(rels.map((e) => readText(b, [e], /./)));
  texts.forEach((xml) => {
    Array.from(xml?.matchAll(/<Relationship\b[^>]*>/gi) ?? []).forEach(([tag]) => {
      if (!/TargetMode\s*=\s*"External"/i.test(tag)) return;
      const target = /Target\s*=\s*"([^"]+)"/i.exec(tag)?.[1]?.replace(/&amp;/g, '&');
      const type = /Type\s*=\s*"[^"]*\/([^/"]+)"/i.exec(tag)?.[1] ?? '';
      if (!target || !/^https?:|^\\\\|^file:/i.test(target)) return;
      if (/^https?:/i.test(target)) scan.link(target);
      if (/hyperlink/i.test(type)) return;
      if (/attachedTemplate/i.test(type)) {
        scan.add(
          'bad',
          'It loads a template from the internet when opened, a way to sneak in macros.'
        );
      } else {
        scan.add('warn', 'It pulls content from the internet when opened.');
      }
      scan.does(`Loads ${target} when opened.`);
    });
  });

  const body = await readText(b, entries, /^word\/document\.xml$/i);
  const links = entries.filter((e) => /^xl\/externalLinks\/[^/]+\.xml$/i.test(e.name)).slice(0, 5);
  const linkXml = await Promise.all(links.map((e) => readText(b, [e], /./)));
  if (
    (body && /DDEAUTO|<w:instrText[^>]*>\s*DDE\b|w:instr="\s*DDE/i.test(body)) ||
    linkXml.some((xml) => xml && /<ddeLink\b/i.test(xml))
  ) {
    scan.add('bad', 'It uses DDE, an old feature that can run commands when the file opens.');
    scan.does('Runs a command through DDE when opened.');
  }

  const embedded = entries.filter((e) => /\/embeddings\//i.test(e.name)).slice(0, 10);
  if (embedded.length > 0) scan.does('Has other files embedded inside it.');
  const blobs = await Promise.all(embedded.map((e) => readEntry(b, e)));
  if (
    embedded.some((e) => HIDDEN_PROGRAM.test(e.name)) ||
    blobs.some(
      (d) =>
        d &&
        hasBytes(d, 'Ole10Native', true) &&
        HIDDEN_PROGRAM.test(new TextDecoder('latin1').decode(d.subarray(0, 4096)))
    )
  ) {
    scan.add('bad', 'It has a program or script hidden inside it.');
  }
};
