// Rebuilds public/yara/reversinglabs.yar from a checkout of
// github.com/reversinglabs/reversinglabs-yara-rules: node scripts/yara-rules.mjs <checkout>
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.argv[2];
if (!repo) throw new Error('Pass the path to a reversinglabs-yara-rules checkout.');
const files = [];
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.isDirectory()) walk(join(dir, e.name));
    else if (e.name.endsWith('.yara')) files.push(join(dir, e.name));
  });
walk(join(repo, 'yara'));
files.sort();
const commit = execSync('git rev-parse HEAD', { cwd: repo }).toString().trim();
const license = readFileSync(join(repo, 'LICENSE'), 'utf8').trim();
const header = `/*\nReversingLabs YARA rules, commit ${commit}\n${license}\n*/\n`;
writeFileSync(
  'public/yara/reversinglabs.yar',
  header + files.map((f) => readFileSync(f, 'utf8')).join('\n')
);
console.log(`${files.length} rule files`);
