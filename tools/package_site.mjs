import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, '.pages');
// Only remove the generated staging directory owned by this script.
fs.rmSync(out, {recursive:true,force:true});
fs.mkdirSync(out);
const publicFiles = fs.readdirSync(root).filter(f => /\.(html|css|js|png|jpg|svg)$/.test(f) || ['robots.txt','sitemap.xml','llms.txt','fc0ca6ba5fb112a7b446b0ad52d01f0c.txt','CODEXGUIDE-LICENSE.txt','LUCIAN-UI-LICENSE.txt'].includes(f));
for (const file of publicFiles) fs.copyFileSync(path.join(root,file),path.join(out,file));
// Package tracked brand assets and the explicitly imported documentation assets.
// Preserve unrelated untracked local experiments outside the release package.
const trackedAssets = execFileSync('git', ['ls-files', '-z', '--', 'assets'], { cwd: root }).toString().split('\0').filter(Boolean);
const importedAssets = Object.values(JSON.parse(fs.readFileSync(path.join(root, 'data/codex-assets.json'), 'utf8'))).map(a => a.local).filter(Boolean);
for (const asset of new Set([...trackedAssets, ...importedAssets])) {
  if (!asset.startsWith('assets/') || asset.includes('..')) throw new Error(`Unexpected asset path: ${asset}`);
  fs.mkdirSync(path.dirname(path.join(out, asset)), { recursive: true });
  fs.copyFileSync(path.join(root, asset), path.join(out, asset));
}
fs.mkdirSync(path.join(out,'data'));
for (const file of ['ai-field.json','codex-search.json']) fs.copyFileSync(path.join(root,'data',file),path.join(out,'data',file));
console.log(`Packaged ${publicFiles.length} public files plus assets and runtime data into .pages/`);
