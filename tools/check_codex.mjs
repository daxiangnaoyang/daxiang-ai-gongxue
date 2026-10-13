import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseDocument, DomUtils } from 'htmlparser2';
import { marked } from 'marked';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/codex-manifest.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/codex-source.json'), 'utf8'));
const assets = JSON.parse(fs.readFileSync(path.join(root, 'data/codex-assets.json'), 'utf8'));
const search = JSON.parse(fs.readFileSync(path.join(root, 'data/codex-search.json'), 'utf8'));
const issues = [];
const parsed = new Map();
const read = f => {
  if (!parsed.has(f)) parsed.set(f, parseDocument(fs.readFileSync(path.join(root, f), 'utf8')));
  return parsed.get(f);
};
const elements = dom => DomUtils.findAll(e => e.type === 'tag' || e.type === 'script', dom.children);
const getText = e => DomUtils.textContent(e);
let links = 0, images = 0, codeBlocks = 0;
for (const file of manifest.files) {
  const dom = read(file); const nodes = elements(dom);
  const ids = nodes.map(e => e.attribs?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) issues.push(`${file}: duplicate IDs`);
  if (nodes.filter(e => e.name === 'h1').length !== 1) issues.push(`${file}: expected one h1`);
  if (!nodes.find(e => e.name === 'link' && e.attribs.rel === 'canonical' && e.attribs.href === `https://daxiangai.cc/${file}`)) issues.push(`${file}: canonical missing`);
  for (const e of nodes) {
    if (Object.keys(e.attribs || {}).some(a => /^on/i.test(a))) issues.push(`${file}: unexpected inline event handler`);
    if (e.name === 'script' && (e.attribs.src !== 'codex.js' || getText(e).trim())) issues.push(`${file}: unexpected script`);
    const href = e.attribs?.href;
    const src = e.attribs?.src;
    for (const value of [href, src].filter(Boolean)) {
      if (/^(https?:|mailto:|tel:)/.test(value)) continue;
      if (/^(javascript:|data:)/i.test(value)) { issues.push(`${file}: unsafe URL`); continue; }
      const [pathname, fragment] = value.split('#');
      const target = pathname ? decodeURIComponent(pathname.split('?')[0]) : file;
      if (!fs.existsSync(path.join(root, target))) { issues.push(`${file}: missing ${target}`); continue; }
      if (href) links++;
      if (fragment && target.endsWith('.html')) {
        const targetIds = elements(read(target)).map(el => el.attribs?.id);
        if (!targetIds.includes(decodeURIComponent(fragment))) issues.push(`${file}: missing fragment ${value}`);
      }
    }
    if (e.name === 'img') {
      images++;
      if (/^https?:/.test(src)) issues.push(`${file}: unmirrored image ${src}`);
      if (!('alt' in e.attribs)) issues.push(`${file}: missing image alt`);
      if (!e.attribs.width || !e.attribs.height) issues.push(`${file}: missing image layout dimensions`);
    }
  }
}
for (const article of source.articles) {
  if (crypto.createHash('sha256').update(article.markdown).digest('hex') !== article.sha256) issues.push(`${article.path}: altered source`);
  const [group, name] = article.path.replace('docs/', '').split('/');
  const file = name === '00-index.md' ? `codex-${group}.html` : `codex-${group}-${name.replace('.md', '.html')}`;
  const codes = [];
  let fence; let lines = []; let indent = 0;
  const body = article.markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
  for (const line of body.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker && !fence) { fence = marker[1][0]; lines = []; indent = line.indexOf(marker[1]); }
    else if (marker && fence === marker[1][0]) { codes.push(lines.join('\n').replace(/\n$/, '')); fence = null; }
    else if (fence) lines.push(line.replace(new RegExp(`^ {0,${indent}}`), ''));
  }
  const rendered = elements(read(file)).filter(e => e.name === 'pre').map(e => getText(e).replace(/\n$/, ''));
  if (JSON.stringify(codes) !== JSON.stringify(rendered)) issues.push(`${file}: code example fidelity mismatch`);
  codeBlocks += codes.length;
  // Compare the entire original prose after Markdown rendering, removing only
  // framework wrappers, the title already displayed in the page header, and UI controls.
  const cleanSource = body.replace(/^<SectionIntro[^\n]*\n/gm, '').replace(/^:::.*$/gm, '').replace(/^# (.+)$/m, '');
  const expectedText = getText(parseDocument(marked.parse(cleanSource))).replace(/\s+/g, '');
  const prose = elements(read(file)).find(e => (e.attribs?.class || '').split(' ').includes('docs-prose'));
  const cloned = parseDocument(DomUtils.getOuterHTML(prose));
  for (const e of elements(cloned)) if (['heading-link','docs-code-bar'].some(c => (e.attribs?.class || '').split(' ').includes(c))) DomUtils.removeElement(e);
  // Callout labels are additional presentation text; remove these labels from
  // the generated text before the comparison rather than dropping source prose.
  const labels = [...body.matchAll(/^::: (?:tip|warning|caution|info|note|details)[ \t]+(.+)$/gm)].map(m => m[1].replace(/\s+/g,''));
  for (const callout of elements(cloned).filter(e => e.name === 'aside')) {
    const label = DomUtils.findOne(e => e.name === 'strong', callout.children, true);
    if (label && labels.includes(getText(label).replace(/\s+/g, ''))) DomUtils.removeElement(label);
  }
  const comparable = getText(cloned).replace(/\s+/g, '');
  if (comparable !== expectedText) issues.push(`${file}: prose fidelity mismatch`);
  const text = getText(read(file));
  const headings = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1].replace(/[*`]/g, ''));
  for (const heading of headings) if (!text.includes(heading)) issues.push(`${file}: missing source heading ${heading}`);
}
for (const [url, asset] of Object.entries(assets)) {
  if (!asset.local) { issues.push(`Unmirrored asset: ${url}`); continue; }
  const data = fs.readFileSync(path.join(root, asset.local));
  if (crypto.createHash('sha256').update(data).digest('hex') !== asset.sha256) issues.push(`Asset integrity: ${asset.local}`);
}
if (search.length !== manifest.articles || new Set(search.map(d => d.file)).size !== manifest.articles) issues.push('Incomplete search index');
if (!fs.readFileSync(path.join(root, 'CODEXGUIDE-LICENSE.txt'), 'utf8').includes(source.license.trim())) issues.push('License mismatch');
if (!fs.readFileSync(path.join(root, 'LUCIAN-UI-LICENSE.txt'), 'utf8').includes('Copyright (c) 2026 Seokwoooo')) issues.push('Missing UI license');
if (!fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('id="codex"')) issues.push('Missing homepage entry');
if (issues.length) { console.error(issues.join('\n')); process.exit(1); }
console.log(`PASS: ${manifest.files.length} pages, ${links} local links, ${images} image references, ${codeBlocks} intact code examples, ${Object.keys(assets).length} verified assets.`);
