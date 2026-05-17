import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/env.js';
import { listVersionedAndUntrackedFiles } from '../core/git.js';
import { absoluteFromRepo, folderOf, isGuidePath, toPosixPath } from '../core/paths.js';
import type { CommandResult } from './check.js';

interface SiteOptions {
  outDir?: string;
  title?: string;
}

interface GuidePage {
  id: string;
  title: string;
  folderPath: string;
  guidePath: string;
  html: string;
  excerpt: string;
  searchText: string;
}

export async function runSite(cwd = process.cwd(), options: SiteOptions = {}): Promise<CommandResult> {
  const { repoRoot } = loadConfig(cwd);
  const title = options.title?.trim() || `${path.basename(repoRoot)} guide`;
  const guidePaths = listVersionedAndUntrackedFiles(repoRoot).filter(isGuidePath).sort(compareGuidePaths);

  if (guidePaths.length === 0) {
    console.log('No guide.md files found. Run repoguide init first.');
    return { exitCode: 1 };
  }

  const pages = guidePaths.map((guidePath) => guidePageFromMarkdown(repoRoot, guidePath));
  const outDir = options.outDir ? path.resolve(cwd, options.outDir) : path.join(repoRoot, 'repoguide-site');
  fs.mkdirSync(outDir, { recursive: true });
  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, renderSite(title, pages), 'utf8');

  console.log(`Wrote wiki site to ${displayOutputPath(repoRoot, indexPath)} (${pages.length} guides).`);
  return { exitCode: 0 };
}

function displayOutputPath(repoRoot: string, outputPath: string): string {
  const relative = toPosixPath(path.relative(repoRoot, outputPath));
  return relative && !relative.startsWith('../') && relative !== '..' ? relative : outputPath;
}

function compareGuidePaths(left: string, right: string): number {
  const leftFolder = folderOf(left);
  const rightFolder = folderOf(right);
  const leftDepth = leftFolder === '.' ? 0 : leftFolder.split('/').length;
  const rightDepth = rightFolder === '.' ? 0 : rightFolder.split('/').length;
  return leftDepth - rightDepth || leftFolder.localeCompare(rightFolder);
}

function guidePageFromMarkdown(repoRoot: string, guidePath: string): GuidePage {
  const folderPath = folderOf(guidePath);
  const markdown = fs.readFileSync(absoluteFromRepo(repoRoot, guidePath), 'utf8');
  const bodyMarkdown = stripFirstHeading(markdown);
  const plainText = markdownToPlainText(bodyMarkdown);
  const excerptText = markdownToExcerptText(bodyMarkdown);
  return {
    id: `page-${slugify(folderPath)}`,
    title: folderPath === '.' ? 'Repository Root' : folderPath,
    folderPath,
    guidePath,
    html: renderMarkdown(bodyMarkdown),
    excerpt: firstUsefulLine(excerptText),
    searchText: `${folderPath} ${guidePath} ${plainText}`.toLowerCase()
  };
}

function renderSite(title: string, pages: GuidePage[]): string {
  const pageData = pages.map((page) => ({
    id: page.id,
    title: page.title,
    folderPath: page.folderPath,
    guidePath: page.guidePath,
    excerpt: page.excerpt,
    searchText: page.searchText
  }));
  const rootPage = pages[0]?.id ?? '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
${siteCss()}
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div>
          <p class="eyebrow">repoguide wiki</p>
          <h1>${escapeHtml(title)}</h1>
        </div>
        <button id="theme-toggle" class="icon-button" type="button" title="Toggle color theme" aria-label="Toggle color theme">Theme</button>
      </div>
      <label class="search-label" for="search">Search guides</label>
      <input id="search" class="search" type="search" placeholder="Search paths, notes, workflows..." autocomplete="off">
      <div class="meta-row">
        <span>${pages.length} ${pages.length === 1 ? 'guide' : 'guides'}</span>
        <span>Press / to search</span>
      </div>
      <nav class="guide-nav" aria-label="Guide pages">
        ${pages.map((page) => renderNavLink(page)).join('\n        ')}
      </nav>
    </aside>
    <main class="content" id="content">
      <div id="empty-state" class="empty-state" hidden>No guides match your search.</div>
      ${pages.map((page) => renderArticle(page)).join('\n      ')}
    </main>
  </div>
  <script id="page-data" type="application/json">${escapeScriptJson(JSON.stringify(pageData))}</script>
  <script>
${siteJs(rootPage)}
  </script>
</body>
</html>
`;
}

function renderNavLink(page: GuidePage): string {
  return `<a class="nav-link" href="#${escapeAttribute(page.id)}" data-page="${escapeAttribute(page.id)}">
          <span class="nav-title">${escapeHtml(page.title)}</span>
          <span class="nav-path">${escapeHtml(page.guidePath)}</span>
        </a>`;
}

function renderArticle(page: GuidePage): string {
  return `<article class="guide-page" id="${escapeAttribute(page.id)}" data-page="${escapeAttribute(page.id)}" tabindex="-1">
        <header class="page-header">
          <p class="eyebrow">${escapeHtml(page.guidePath)}</p>
          <h2>${escapeHtml(page.title)}</h2>
          ${page.excerpt ? `<p class="excerpt">${escapeHtml(page.excerpt)}</p>` : ''}
        </header>
        <div class="markdown-body">
${page.html}
        </div>
      </article>`;
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: 'ul' | 'ol' | undefined;
  let inCode = false;
  let codeLines: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = (): void => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = undefined;
  };

  const openList = (type: 'ul' | 'ol'): void => {
    if (listType === type) return;
    closeList();
    html.push(`<${type}>`);
    listType = type;
  };

  for (const line of lines) {
    const fence = /^```/.exec(line);
    if (fence) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(6, heading[1].length + 1);
      const text = heading[2].trim();
      html.push(`<h${level} id="h-${escapeAttribute(slugify(text))}">${renderInline(text)}</h${level}>`);
      continue;
    }

    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    if (unordered) {
      flushParagraph();
      openList('ul');
      html.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }

    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (ordered) {
      flushParagraph();
      openList('ol');
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  flushParagraph();
  closeList();
  return html.join('\n');
}

function stripFirstHeading(markdown: string): string {
  return markdown.replace(/^\s*#\s+.+(?:\r?\n)+/, '');
}

function renderInline(value: string): string {
  let rendered = escapeHtml(value);
  rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, rawHref: string) => {
    const href = safeHref(rawHref);
    return `<a href="${escapeAttribute(href)}">${label}</a>`;
  });
  return rendered;
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_>\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

function markdownToExcerptText(markdown: string): string {
  const lines: string[] = [];
  let inCode = false;
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (/^```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode || /^#{1,6}\s+/.test(line)) continue;
    lines.push(line);
  }
  return markdownToPlainText(lines.join('\n'));
}

function firstUsefulLine(plainText: string): string {
  const sentence = plainText.split(/(?<=[.!?])\s+/).find((line) => line.length > 24) ?? plainText;
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}...` : sentence;
}

function safeHref(rawHref: string): string {
  const href = rawHref.trim();
  if (/^(https?:|mailto:|#|\.{0,2}\/)/i.test(href)) return href;
  return '#';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'root';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeScriptJson(value: string): string {
  return value
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function siteCss(): string {
  return `:root {
  color-scheme: light;
  --bg: #f7f9fb;
  --panel: #ffffff;
  --text: #18202a;
  --muted: #637083;
  --line: #d9e1e8;
  --accent: #0b7a75;
  --accent-strong: #7b3f8c;
  --code: #eef4f7;
  --shadow: 0 18px 50px rgba(24, 32, 42, 0.10);
}

body.dark {
  color-scheme: dark;
  --bg: #121315;
  --panel: #1d2024;
  --text: #f0f3f5;
  --muted: #a9b3bd;
  --line: #353b43;
  --accent: #67d2c7;
  --accent-strong: #e0a8f2;
  --code: #262b31;
  --shadow: 0 18px 55px rgba(0, 0, 0, 0.28);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-shell {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: auto;
  padding: 28px;
  background: var(--panel);
  border-right: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1, h2, h3, h4 {
  margin: 0;
  line-height: 1.15;
}

h1 { font-size: 2.1rem; }

.icon-button {
  min-width: 64px;
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
}

.search-label {
  display: block;
  margin-top: 28px;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 700;
}

.search {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 0 18px;
  color: var(--muted);
  font-size: 0.84rem;
}

.guide-nav {
  display: grid;
  gap: 8px;
}

.nav-link {
  display: block;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text);
  text-decoration: none;
}

.nav-link:hover,
.nav-link.active {
  background: var(--bg);
  border-color: var(--line);
}

.nav-link.active {
  box-shadow: inset 3px 0 0 var(--accent);
}

.nav-title,
.nav-path {
  display: block;
  overflow-wrap: anywhere;
}

.nav-title { font-weight: 800; }

.nav-path {
  color: var(--muted);
  font-size: 0.82rem;
}

.content {
  max-width: 1040px;
  width: 100%;
  padding: 48px min(7vw, 84px);
}

.guide-page {
  display: none;
  outline: none;
}

.guide-page.active { display: block; }

.page-header {
  margin-bottom: 30px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--line);
}

.page-header h2 {
  font-size: 3.4rem;
  overflow-wrap: anywhere;
}

.excerpt {
  max-width: 760px;
  margin: 16px 0 0;
  color: var(--muted);
  font-size: 1.08rem;
}

.markdown-body {
  max-width: 820px;
}

.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 2.1em;
  margin-bottom: 0.55em;
}

.markdown-body h2 { font-size: 1.65rem; }
.markdown-body h3 { font-size: 1.22rem; }

.markdown-body p,
.markdown-body ul,
.markdown-body ol,
.markdown-body blockquote,
.markdown-body pre {
  margin: 0 0 1.05rem;
}

.markdown-body a { color: var(--accent-strong); }

.markdown-body code {
  padding: 0.16em 0.34em;
  border-radius: 6px;
  background: var(--code);
  font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
  font-size: 0.92em;
}

.markdown-body pre {
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--code);
  box-shadow: var(--shadow);
}

.markdown-body pre code {
  padding: 0;
  background: transparent;
}

.markdown-body blockquote {
  border-left: 4px solid var(--accent);
  padding-left: 16px;
  color: var(--muted);
}

.empty-state {
  padding: 48px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--muted);
}

@media (max-width: 820px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar {
    position: static;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .content { padding: 32px 22px; }
  h1 { font-size: 1.8rem; }
  .page-header h2 { font-size: 2.35rem; }
}`;
}

function siteJs(rootPage: string): string {
  return `const pages = JSON.parse(document.getElementById('page-data').textContent);
const links = [...document.querySelectorAll('.nav-link')];
const articles = [...document.querySelectorAll('.guide-page')];
const search = document.getElementById('search');
const empty = document.getElementById('empty-state');
const themeToggle = document.getElementById('theme-toggle');

function setTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('repoguide-theme', theme);
}

setTheme(localStorage.getItem('repoguide-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeToggle.addEventListener('click', () => setTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));

function activate(id) {
  const next = pages.some((page) => page.id === id) ? id : '${rootPage}';
  for (const article of articles) article.classList.toggle('active', article.dataset.page === next);
  for (const link of links) link.classList.toggle('active', link.dataset.page === next);
  const article = document.querySelector('[data-page="' + CSS.escape(next) + '"].guide-page');
  if (article) article.focus({ preventScroll: true });
}

function route() {
  activate(location.hash.slice(1));
}

function applySearch() {
  const query = search.value.trim().toLowerCase();
  let visible = 0;
  for (const link of links) {
    const page = pages.find((candidate) => candidate.id === link.dataset.page);
    const show = !query || page.searchText.includes(query);
    link.hidden = !show;
    if (show) visible += 1;
  }
  empty.hidden = visible !== 0;
  const active = links.find((link) => link.classList.contains('active'));
  if (query && active?.hidden) {
    const first = links.find((link) => !link.hidden);
    if (first) location.hash = first.dataset.page;
  }
}

window.addEventListener('hashchange', route);
search.addEventListener('input', applySearch);
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
});

if (!location.hash) location.hash = '${rootPage}';
route();
applySearch();`;
}
