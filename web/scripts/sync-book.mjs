// 从仓库根的 book/ 生成 web/src/content/docs/ 下的章节页面。
// 正文源文件不改动：图题和图说从 alt 里拆，图号按章节和顺序生成。
// 章节页面按英文 slug 命名，路由由文件名决定。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chapterByNumber } from '../src/lib/chapters.ts';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '..');
const BOOK = join(REPO, 'book');
const DOCS = join(WEB, 'src/content/docs');
const CHAPTERS = join(DOCS, 'chapters');
const EDIT_BASE = 'https://github.com/rroy233/agent-evaluation-notes/edit/main';

const problems = [];
const note = (msg) => problems.push(msg);

// ---------- 小工具 ----------

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');
const stripInline = (s) => s.replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

function gitDate(relPath) {
  for (const args of [['-1', '--format=%cI', '--', relPath], ['-1', '--format=%cI']]) {
    try {
      const out = execFileSync('git', ['log', ...args], { cwd: REPO, encoding: 'utf8' }).trim();
      if (out) return out;
    } catch { /* 没有 git 历史就跳过 */ }
  }
  return null;
}

function firstParagraph(body) {
  for (const block of body.split(/\n{2,}/)) {
    const t = block.trim();
    if (!t || t.startsWith('#') || t.startsWith('!') || t.startsWith('|') || t.startsWith('图注：')) continue;
    const plain = stripInline(t.replace(/\n/g, '')).trim();
    if (plain) return plain.length > 78 ? `${plain.slice(0, 78)}…` : plain;
  }
  return '';
}

// 把正文里的 [n] 换成 <Cite>，跳过行内代码。第一次出现的那处带锚点，供参考文献回跳。
function convertCitations(text, cited) {
  return text
    .split(/(`[^`\n]*`)/)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(/\[(\d+)\]/g, (_, d) => {
        const n = Number(d);
        const first = !cited.has(n);
        cited.add(n);
        return `<Cite n={${n}}${first ? ' anchor' : ''} />`;
      });
    })
    .join('');
}

// 参考文献条目里的行内语法只有链接和行内代码两种。
function renderInline(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// 参考文献条目的回跳图标。用内联 SVG 而不是「↩」字符，
// 因为两款字体都没有这个字形，用字符会掉到系统字体上。
const BACK_ICON =
  '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 2 3 9h3v5h4V9h3z"/></svg>';

function renderReferences(refText, cited) {
  const entries = [];
  const re = /^\s*(\d+)\.\s+([\s\S]*?)(?=\n\s*\d+\.\s|\s*$)/gm;
  let m;
  while ((m = re.exec(refText))) entries.push([Number(m[1]), m[2].replace(/\s*\n\s*/g, ' ').trim()]);

  const expected = entries.map(([n]) => n);
  const contiguous = expected.every((n, i) => n === i + 1);
  if (!contiguous) note(`参考文献编号不连续：${expected.join(', ')}`);
  const dangling = [...cited].filter((n) => !expected.includes(n));
  if (dangling.length) note(`正文引用了不存在的参考文献编号：${dangling.join(', ')}`);

  const items = entries
    .map(([n, text]) => {
      const back = cited.has(n)
        ? ` <a class="ref-back" href="#cite-${n}" title="返回正文" aria-label="返回正文">${BACK_ICON}</a>`
        : '';
      return `  <li id="ref-${n}">${renderInline(text)}${back}</li>`;
    })
    .join('\n');
  return `<ol class="references">\n${items}\n</ol>`;
}

// 从 alt 里拆图题和图说。约定：第一句是图题，其余是图说。
// 首句超过 30 字或没有后半时视为不符合约定，整段当图说。
function splitAlt(alt, where) {
  const cut = alt.indexOf('。');
  if (cut === -1) {
    note(`${where}：alt 里没有句号，无法拆出图题，将整段作为图说`);
    return { title: '', desc: alt };
  }
  const title = alt.slice(0, cut);
  const desc = alt.slice(cut + 1).trim();
  if (!desc || title.length > 30) {
    note(`${where}：图题 ${title.length} 字、图说 ${desc.length} 字，不符合“首句即图题”的约定，已回退为整段图说`);
    return { title: '', desc: alt };
  }
  // 原 alt 的末句常常没有句号，图注里要补上，否则渲染出来断在半句。
  const ended = /[。！？…：；]$/.test(desc) ? desc : `${desc}。`;
  return { title, desc: ended };
}

function splitCaption(caption, where) {
  const body = caption.replace(/^图注：\s*/, '').trim();
  const m = body.match(/^(.*?)图片来自\s*\[(\d+)\]。?$/);
  if (!m) {
    note(`${where}：图注里没有找到“图片来自 [n]”，出处将留空`);
    return { note: body, source: null };
  }
  return { note: m[1].trim(), source: Number(m[2]) };
}

// ---------- 章节 ----------

function syncChapter(file, index) {
  const chapter = chapterByNumber(index);
  if (!chapter) {
    note(`${file}：src/lib/chapters.ts 里没有第 ${index} 章的记录`);
    return null;
  }
  const raw = readFileSync(join(BOOK, file), 'utf8');
  const h1 = raw.match(/^#\s+(.+)$/m);
  if (!h1) {
    note(`${file}：找不到一级标题，无法生成 title`);
    return null;
  }
  const title = h1[1].trim();
  const expected = `第 ${chapter.n} 章 ${chapter.title}`;
  if (title !== expected) note(`${file}：一级标题“${title}”与 chapters.ts 里的“${expected}”不一致`);
  const body = raw.replace(/^#\s+.+$/m, '').replace(/^\n+/, '');

  const refSplit = body.split(/^##\s*参考文献\s*$/m);
  if (refSplit.length !== 2) note(`${file}：找不到唯一的“## 参考文献”小节`);
  let main = refSplit[0];
  const refText = refSplit[1] ?? '';

  // 抽图：图片行加紧随的“图注：”段落，整体换成 <Figure />
  const imports = [];
  let figureCount = 0;
  main = main.replace(
    /^!\[([^\]]*)\]\(([^)]+)\)\s*\n+(图注：[^\n]*)$/gm,
    (whole, alt, src, caption) => {
      figureCount += 1;
      const id = `fig${figureCount}`;
      const number = `${index}-${figureCount}`;
      const where = `${file} 图 ${number}`;
      const { title: figTitle, desc } = splitAlt(alt, where);
      const { note: figNote, source } = splitCaption(caption, where);
      imports.push(`import ${id} from './${src}';`);
      const props = [
        `src={${id}}`,
        figTitle ? `title="${escapeAttr(figTitle)}"` : null,
        `desc="${escapeAttr(desc)}"`,
        `number="${number}"`,
        `figcaption="${escapeAttr(figNote)}"`,
        source === null ? null : `source={${source}}`,
      ].filter(Boolean);
      return `<Figure ${props.join(' ')} />`;
    },
  );

  const missingCaption = /^!\[[^\]]*\]\([^)]+\)\s*$/m.test(main);
  if (missingCaption) note(`${file}：有图片没有紧跟“图注：”段落`);

  const cited = new Set();
  main = convertCitations(main, cited).trimEnd();

  const refs = refText.trim() ? `\n\n## 参考文献\n\n${renderReferences(refText, cited)}\n` : '\n';
  if (!refText.trim()) note(`${file}：正文里的引用编号没有对应的参考文献`);

  const date = gitDate(join('book', file));
  const fm = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(firstParagraph(main.replace(/<[^>]+>/g, '')))}`,
    date ? `lastUpdated: ${date}` : null,
    `editUrl: ${EDIT_BASE}/book/${file}`,
    '---',
  ].filter(Boolean);

  const out = [
    ...fm,
    '',
    `import Figure from '../../../components/Figure.astro';`,
    `import Cite from '../../../components/Cite.astro';`,
    ...imports,
    '',
    main,
    refs,
  ].join('\n');

  writeFileSync(join(CHAPTERS, `${chapter.slug}.mdx`), out);
  return { file, slug: chapter.slug, title, figures: figureCount, citations: cited.size, refs: refText.trim() ? 'yes' : 'no' };
}

// ---------- 图片 ----------

function copyImages() {
  const from = join(BOOK, 'images');
  const to = join(CHAPTERS, 'images');
  mkdirSync(to, { recursive: true });
  let copied = 0;
  let skipped = 0;
  const wanted = new Set();
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    wanted.add(name);
    const src = join(from, name);
    const dst = join(to, name);
    const s = statSync(src);
    if (existsSync(dst)) {
      const d = statSync(dst);
      if (d.size === s.size && d.mtimeMs >= s.mtimeMs) { skipped += 1; continue; }
    }
    copyFileSync(src, dst);
    copied += 1;
  }
  return { copied, skipped, total: wanted.size };
}

// ---------- 主流程 ----------

mkdirSync(CHAPTERS, { recursive: true });
// 章节页面每次重建。旧的编号文件名不会自己消失，先清掉，避免留下失效路由。
for (const name of readdirSync(CHAPTERS)) {
  if (name.endsWith('.mdx')) rmSync(join(CHAPTERS, name), { force: true });
}

const chapterFiles = readdirSync(BOOK)
  .filter((f) => /^chapter\d+\.md$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
if (chapterFiles.length === 0) note('book/ 下没有找到 chapterN.md');

const chapters = chapterFiles.map((f, i) => syncChapter(f, i + 1)).filter(Boolean);
for (const filename of ['outline.md', 'sources.md']) {
  rmSync(join(DOCS, filename), { force: true });
}
const images = copyImages();

console.log(`同步完成：${chapters.length} 章、图片 ${images.total} 张（复制 ${images.copied}，跳过 ${images.skipped}）`);
for (const c of chapters) console.log(`  ${c.file} → chapters/${c.slug}.mdx：${c.title}｜图 ${c.figures}｜引用 ${c.citations} 个编号`);

if (problems.length) {
  console.error(`\n发现 ${problems.length} 处问题：`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
