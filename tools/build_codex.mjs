import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/codex-source.json'), 'utf8'));
const assetFile = path.join(root, 'data/codex-assets.json');
const assets = fs.existsSync(assetFile) ? JSON.parse(fs.readFileSync(assetFile, 'utf8')) : {};
const groups = [
  { id: 'start', name: '快速上手', label: 'START HERE', intro: '从安装到第一个任务，先把 Codex 用起来。', tone: 'mint' },
  { id: 'advanced', name: '进阶教程', label: 'BUILD YOUR WORKFLOW', intro: '把任务、规则和工具连成一套可复用的工作流。', tone: 'blue' },
  { id: 'recipes', name: '实战案例', label: 'MAKE SOMETHING', intro: '选一件想做的事，沿着完整步骤做出成果。', tone: 'peach' }
];
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = s => sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} });
const slug = s => plain(s).toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-');
const fileOf = p => {
  const [group, name] = p.replace(/^docs\//, '').split('/');
  return name === '00-index.md' ? `codex-${group}.html` : `codex-${group}-${name.replace(/\.md$/, '.html')}`;
};
const frontmatter = markdown => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const description = match?.[1].match(/^description:\s*"(.*)"\s*$/m)?.[1] || '';
  return { description, body: match ? markdown.slice(match[0].length) : markdown };
};
const docs = snapshot.articles.map(a => {
  if (crypto.createHash('sha256').update(a.markdown).digest('hex') !== a.sha256) throw new Error(`Source integrity mismatch: ${a.path}`);
  const { description, body } = frontmatter(a.markdown);
  const title = body.match(/^# (.+)$/m)?.[1];
  if (!title) throw new Error(`Missing title: ${a.path}`);
  const group = a.path.split('/')[1];
  return { ...a, title, description, body, group, file: fileOf(a.path), index: a.path.endsWith('/00-index.md'), verified: body.match(/官方资料最后核对日期[：:]\s*(\d{4}-\d{2}-\d{2})/)?.[1] || null };
}).sort((a, b) => groups.findIndex(g => g.id === a.group) - groups.findIndex(g => g.id === b.group) || a.path.localeCompare(b.path));
const byPath = new Map(docs.map(d => [d.path, d]));
const origin = 'https://codexguide.ai';
function resolveLink(value, current, image = false) {
  if (!value || value.startsWith('#') || /^(mailto:|tel:)/.test(value)) return value;
  let sourcePath;
  let fragment = '';
  if (/^https?:\/\//.test(value)) {
    const parsed = new URL(value);
    if (image) return assets[value]?.local || value;
    if (parsed.origin !== origin) return value;
    sourcePath = 'docs' + parsed.pathname;
    fragment = parsed.hash;
  } else {
    const [pathname, hash] = value.split('#');
    fragment = hash ? '#' + hash : '';
    sourcePath = pathname.startsWith('/') ? 'docs' + pathname : path.posix.normalize(path.posix.join(path.posix.dirname(current.path), pathname));
  }
  if (image) {
    const raw = `https://raw.githubusercontent.com/freestylefly/CodexGuide/${snapshot.commit}/${sourcePath}`;
    return assets[raw]?.local || raw;
  }
  sourcePath = sourcePath.replace(/\.html$/, '.md');
  if (sourcePath.endsWith('/')) sourcePath += '00-index.md';
  if (!sourcePath.endsWith('.md')) sourcePath += '/00-index.md';
  const target = byPath.get(sourcePath);
  if (target) {
    // Upstream team-playbook still refers to a renamed AGENTS.md section.
    if (target.path === 'docs/advanced/02-agents-md.md' && decodeURIComponent(fragment) === '#团队共享规则和本地私有规则') fragment = '#团队协作';
    return target.file + fragment;
  }
  return origin + '/' + sourcePath.replace(/^docs\//, '').replace(/00-index\.md$/, '').replace(/\.md$/, '.html') + fragment;
}
function convertContainers(body) {
  // Only convert VuePress callouts outside fenced code; retain every code example.
  let fence = null;
  const stack = [];
  const output = [];
  for (const line of body.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      output.push(line); continue;
    }
    if (!fence && /^<SectionIntro\b/.test(line)) continue;
    const open = !fence && line.match(/^:::\s+(tip|warning|caution|info|note|details)\s*(.*)$/);
    if (open) {
      stack.push(open[1]);
      output.push(`\n<aside class="docs-callout ${open[1]}">\n\n${open[2] ? `**${open[2]}**\n` : ''}`);
    } else if (!fence && /^:::\s*$/.test(line)) {
      if (!stack.pop()) throw new Error('Unbalanced VuePress callout');
      output.push('\n</aside>\n');
    } else output.push(line);
  }
  if (stack.length) throw new Error('Unclosed VuePress callout');
  return output.join('\n');
}
function render(current) {
  const headings = [];
  const used = new Map();
  const parser = new Marked({ gfm: true, breaks: false });
  parser.use({ renderer: {
    heading(token) {
      const text = this.parser.parseInline(token.tokens);
      const base = slug(text) || 'section';
      const count = used.get(base) || 0; used.set(base, count + 1);
      const id = count ? `${base}-${count}` : base;
      if (token.depth === 1) return '';
      if (token.depth <= 3) headings.push({ id, title: plain(text), depth: token.depth });
      return `<h${token.depth} id="${escape(id)}">${text}<a class="heading-link" href="#${escape(id)}" aria-label="链接到${escape(plain(text))}">#</a></h${token.depth}>\n`;
    },
    link(token) {
      const href = resolveLink(token.href, current);
      const external = /^https?:/.test(href);
      return `<a href="${escape(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${this.parser.parseInline(token.tokens)}</a>`;
    },
    image(token) {
      const src = resolveLink(token.href, current, true);
      const asset = Object.values(assets).find(a => a.local === src);
      const size = asset?.width && asset?.height ? ` width="${asset.width}" height="${asset.height}"` : '';
      return `<img src="${escape(src)}" alt="${escape(token.text)}"${size} loading="lazy" decoding="async">`;
    },
    code(token) {
      const lang = (token.lang || '').split(' ')[0];
      return `<div class="docs-code"><div class="docs-code-bar"><span>${escape(lang || 'code')}</span><button type="button" class="copy-code" aria-label="复制代码">复制</button></div><pre><code>${escape(token.text)}</code></pre></div>\n`;
    }
  }});
  const html = sanitizeHtml(parser.parse(convertContainers(current.body)), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'aside', 'button', 'input'],
    allowedAttributes: { '*': ['id', 'class', 'aria-label'], a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'], button: ['type'], input: ['type', 'checked', 'disabled'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https', 'http'] }
  }).replace(/<table>/g, '<div class="docs-table"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, headings };
}
const write = (name, text) => fs.writeFileSync(path.join(root, name), text);
const card = d => `<a class="docs-card ${d.group}" href="${d.file}" data-category="${d.group}" data-doc="${d.file}"><span class="docs-card-meta">${groups.find(g => g.id === d.group).name}<span aria-hidden="true">↗</span></span><h3>${escape(d.title)}</h3><p>${escape(d.description)}</p><small>${d.verified ? `资料核对 ${d.verified}` : '按需阅读'}</small></a>`;
const sidebar = current => `<aside class="docs-sidebar" aria-label="内容目录">${groups.map(g => `<details ${current?.group === g.id ? 'open' : ''}><summary>${g.name}<span>${docs.filter(d => d.group === g.id && !d.index).length}</span></summary><nav aria-label="${g.name}">${docs.filter(d => d.group === g.id).map(d => `<a href="${d.file}"${current?.file === d.file ? ' aria-current="page"' : ''}>${escape(d.index ? '总览' : d.title)}</a>`).join('')}</nav></details>`).join('')}</aside>`;
const head = (title, description, file) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · 大象AI共学</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="https://daxiangai.cc/${file}"><meta property="og:title" content="${escape(title)} · 大象AI共学"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="${file === 'codex.html' ? 'website' : 'article'}"><meta property="og:url" content="https://daxiangai.cc/${file}"><link rel="icon" href="logo-blue.png"><link rel="stylesheet" href="codex.css"><script src="codex.js" defer></script></head><body><a class="docs-skip" href="#content">跳到正文</a><header class="docs-header"><a class="docs-brand" href="index.html"><img src="logo-blue-transparent-v2.png" alt="" width="44" height="44"><span>大象AI共学</span></a><nav aria-label="主导航"><a href="course.html">学习路线</a><a href="codex.html"${file === 'codex.html' ? ' aria-current="page"' : ''}>Codex</a>${groups.map(g => `<a href="codex-${g.id}.html"${file.startsWith(`codex-${g.id}`) ? ' aria-current="page"' : ''}>${g.name}</a>`).join('')}</nav><a class="docs-home-link" href="index.html">官网 ↗</a></header>`;
const footer = `<footer class="docs-footer"><a href="index.html">大象AI共学</a><a href="codex.html">Codex 内容中心</a><a href="course.html">学习路线</a></footer></body></html>`;

const articles = docs.filter(d => !d.index);
const counts = groups.map(g => ({ ...g, count: articles.filter(d => d.group === g.id).length }));
const featuredPaths = ['docs/start/02-app-installation.md', 'docs/start/06-first-task.md', 'docs/recipes/01-ppt-skill-walkthrough.md', 'docs/recipes/06-feishu-cli-codex.md', 'docs/recipes/07-llm-wiki-codex.md', 'docs/recipes/10-dkfile-deploy-codex.md'];
const hub = `${head('Codex 快速上手、进阶教程与实战案例', '从安装到真实工作流，按问题找到 Codex 的完整步骤和实战案例。', 'codex.html')}<main id="content" class="docs-hub"><section class="docs-hero"><div><p class="docs-eyebrow">CODEX / 从一个任务开始</p><h1>先做成一件事，<br><em>再把方法留下来。</em></h1><p>从安装、第一次使用，到连接工具、做出作品。按你眼下的任务选一条路，不用从头读到尾。</p><div class="docs-actions"><a class="docs-button" href="codex-start-06-first-task.html">开始第一个任务 ↗</a><a href="#library">找一篇能用的 ↓</a></div></div><div class="docs-route-art" aria-label="从任务到成果的三个步骤"><span class="docs-art-label">YOUR NEXT MOVE</span><div><b>01</b><strong>先用起来</strong><small>安装 · 第一个任务</small></div><div><b>02</b><strong>连成流程</strong><small>规则 · Skills · 自动化</small></div><div><b>03</b><strong>做出成果</strong><small>PPT · 网页 · 知识库</small></div><span class="docs-art-foot">想法 → 动手 → 验证</span></div></section><section class="docs-paths" aria-label="三条阅读路径">${counts.map(g => `<a class="docs-path ${g.tone}" href="codex-${g.id}.html"><span>${g.label} / ${g.count} 篇</span><h2>${g.name} ↗</h2><p>${g.intro}</p></a>`).join('')}</section><section class="docs-featured"><div class="docs-section-head"><p class="docs-eyebrow">从具体任务进入</p><h2>今天想做什么？</h2></div><div class="docs-card-grid">${featuredPaths.map(p => card(byPath.get(p))).join('')}</div></section><section id="library" class="docs-library"><div class="docs-section-head"><p class="docs-eyebrow">完整目录 / ${articles.length} 篇</p><h2>遇到问题，直接找。</h2></div><form class="docs-search" role="search"><label for="docs-search">搜索文章内容</label><div><input id="docs-search" type="search" placeholder="试试：飞书、权限、PPT、安装…" autocomplete="off" aria-controls="docs-results"><button type="submit">搜索</button></div></form><div class="docs-filters" role="group" aria-label="筛选分类"><button type="button" data-filter="all" aria-pressed="true">全部 ${articles.length}</button>${counts.map(g => `<button type="button" data-filter="${g.id}" aria-pressed="false">${g.name} ${g.count}</button>`).join('')}</div><p id="docs-status" role="status">共 ${articles.length} 篇，可按分类或关键词查找。</p><div id="docs-results" class="docs-card-grid">${articles.map(card).join('')}</div><p id="docs-empty" hidden>没有找到匹配内容。试试缩短关键词，或切换到“全部”。</p><noscript><p>浏览器未启用 JavaScript，可直接使用上方分类入口和完整文章目录。</p></noscript></section></main>${footer}`;
write('codex.html', hub
  .replace('<div class="docs-filters" role="group" aria-label="筛选分类">', '<div class="docs-filters" role="group" aria-label="筛选分类"><span class="docs-filter-pill" aria-hidden="true"></span>')
  .replace('<p id="docs-empty" hidden>没有找到匹配内容。试试缩短关键词，或切换到“全部”。</p>', '<div id="docs-empty" class="docs-empty-state" hidden><span class="docs-empty-symbol" aria-hidden="true">⌕</span><h3>换个关键词，再找找。</h3><p>可以减少筛选条件，或从一个具体任务开始。</p><div><button type="button" data-reset-search>清除筛选</button><button type="button" data-suggest="安装">安装</button><button type="button" data-suggest="飞书">飞书</button><button type="button" data-suggest="PPT">PPT</button></div></div>'));
const rendered = new Map();
for (const d of docs) {
  const g = groups.find(g => g.id === d.group);
  const { html, headings } = render(d);
  rendered.set(d.file, { html, headings });
  const siblings = docs.filter(s => s.group === d.group);
  const idx = siblings.indexOf(d);
  const next = siblings[idx + 1]; const prev = siblings[idx - 1];
  // Category Markdown already contains its complete linked directory.
  // Avoid repeating the same directory as another wall of cards.
  const related = '';
  const toc = `<aside class="docs-toc"><details open><summary>本页目录</summary><nav aria-label="本页目录">${headings.map(h => `<a href="#${escape(h.id)}" class="depth-${h.depth}">${escape(h.title)}</a>`).join('')}</nav></details></aside>`;
  const progress = '<div class="docs-reading-status" hidden><span class="docs-reading-ring" role="progressbar" aria-label="正文浏览进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="track" cx="24" cy="24" r="20"/><circle class="fill" cx="24" cy="24" r="20" pathLength="100"/></svg><span>0%</span></span><a href="#content">回到顶部 ↑</a></div><div class="docs-reading-bar" aria-hidden="true" hidden></div>';
  write(d.file, `${head(d.title, d.description, d.file)}<div class="docs-layout">${sidebar(d)}<main id="content" class="docs-article"><nav class="docs-breadcrumb" aria-label="面包屑"><a href="codex.html">Codex</a><span>/</span><a href="codex-${d.group}.html">${g.name}</a>${d.index ? '' : '<span>/</span><span>正文</span>'}</nav><header class="docs-article-head"><p class="docs-eyebrow">${g.label}</p><h1>${escape(d.title)}</h1><p>${escape(d.description)}</p><div class="docs-article-meta"><span>${g.name}</span>${d.verified ? `<span>资料核对 ${d.verified}</span>` : ''}<a href="codex.html#library">搜索更多内容 ↗</a></div></header><article class="docs-prose">${html}</article>${related}<nav class="docs-pagination" aria-label="相邻文章">${prev ? `<a href="${prev.file}"><small>← 上一篇</small><span>${escape(prev.title)}</span></a>` : '<span></span>'}${next ? `<a href="${next.file}"><small>下一篇 →</small><span>${escape(next.title)}</span></a>` : '<a href="codex.html"><small>继续探索 →</small><span>回到内容中心</span></a>'}</nav></main>${toc}</div>${progress}${footer}`);
}
const search = articles.map(d => ({ file: d.file, title: d.title, description: d.description, category: d.group, text: plain(rendered.get(d.file).html).replace(/\s+/g, ' ') }));
write('data/codex-search.json', JSON.stringify(search));
const generated = ['codex.html', ...docs.map(d => d.file)];
write('data/codex-manifest.json', JSON.stringify({ commit: snapshot.commit, synced: snapshot.synced, documents: docs.length, articles: articles.length, files: generated, groups: counts, source: snapshot.repository }, null, 2) + '\n');
let sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/daxiangai\.cc\/codex[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
sitemap = sitemap.replace('</urlset>', generated.map(f => `  <url><loc>https://daxiangai.cc/${f}</loc><lastmod>${snapshot.synced}</lastmod></url>`).join('\n') + '\n</urlset>');
write('sitemap.xml', sitemap);
const homeFile = path.join(root, 'index.html');
const entry = `<section class="content-section home-compact codex-entry" id="codex" aria-labelledby="codex-entry-title"><header class="section-head"><p class="eyebrow">Codex / 从一个任务开始</p><h2 id="codex-entry-title">从第一次使用，<em>到做出自己的成果。</em></h2><p class="lede">安装、工作流与实战案例，在这里直接读完整步骤。选你现在用得上的一篇。</p></header><ul class="article-cards">${counts.map(g => `<li><article><p class="eyebrow">${g.label} · ${g.count} 篇</p><h3>${g.name}</h3><p>${g.intro}</p><a href="codex-${g.id}.html">进入${g.name} ↗</a></article></li>`).join('')}</ul><div class="codex-entry-actions"><a class="btn primary" href="codex-start-06-first-task.html">开始第一个任务 ↗</a><a class="btn secondary" href="codex.html">查看全部 ${articles.length} 篇 →</a></div></section>`;
const home = fs.readFileSync(homeFile, 'utf8');
if (!home.includes('<!-- CODEX-ENTRY-START -->')) throw new Error('Missing homepage insertion marker');
write('index.html', home.replace(/<!-- CODEX-ENTRY-START -->[\s\S]*?<!-- CODEX-ENTRY-END -->/, `<!-- CODEX-ENTRY-START -->\n${entry}\n<!-- CODEX-ENTRY-END -->`));
console.log(`Built ${generated.length} pages: ${articles.length} articles + 3 category indexes + hub.`);
