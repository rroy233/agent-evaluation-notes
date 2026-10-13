// 从仓库根的 book/ 生成 web/src/content/docs/ 下的章节页面。
// 正文源文件不改动：图题和图说从 alt 里拆，图号按章节和顺序生成。
// 章节页面按英文 slug 命名，路由由文件名决定。
// 中文源在 book/cn/，英文源在 book/en/，图片共用 book/images/，两边的引用写法都是 ../images/。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chapterByNumber } from '../src/lib/chapters.ts';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '..');
const BOOK = join(REPO, 'book');
const DOCS = join(WEB, 'src/content/docs');
const EDIT_BASE = 'https://github.com/rroy233/agent-evaluation-notes/edit/main';

// 语种相关约定。slug 跨语种共享；目录、标题格式、图注标记和参考文献标题各自不同。
const LOCALES = [
  {
    id: 'zh-CN',
    bookDir: 'book/cn',
    docsDir: 'chapters',
    importPrefix: '../../../components',
    titleFor: (c) => `第 ${c.n} 章 ${c.title['zh-CN']}`,
    refHeading: '参考文献',
    backTitle: '返回正文',
    captionPrefix: '图注：',
    sourceMarker: ['图片来自'],
    sourceEndPunct: '。',
    altTitleSep: '。',
    endPunct: /[。！？…：；]$/,
    titleMaxLen: 30,
  },
  {
    id: 'en',
    bookDir: 'book/en',
    docsDir: 'en/chapters',
    importPrefix: '../../../../components',
    titleFor: (c) => `Chapter ${c.n} ${c.title.en}`,
    refHeading: 'References',
    backTitle: 'Back to text',
    captionPrefix: 'Caption:',
    sourceMarker: ['Image from'],
    sourceEndPunct: '.',
    altTitleSep: '.',
    endPunct: /[.!?…:;]$/,
    titleMaxLen: 80,
  },
];

const problems = [];
const note = (msg) => problems.push(msg);

// ---------- 小工具 ----------

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function firstParagraph(body, captionPrefix) {
  for (const block of body.split(/\n{2,}/)) {
    const t = block.trim();
    if (!t || t.startsWith('#') || t.startsWith('!') || t.startsWith('|') || t.startsWith(captionPrefix)) continue;
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

function renderReferences(refText, cited, backTitle) {
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
        ? ` <a class="ref-back" href="#cite-${n}" title="${backTitle}" aria-label="${backTitle}">${BACK_ICON}</a>`
        : '';
      return `  <li id="ref-${n}">${renderInline(text)}${back}</li>`;
    })
    .join('\n');
  return `<ol class="references">\n${items}\n</ol>`;
}

// 从 alt 里拆图题和图说。约定：第一句是图题，其余是图说。
// 首句过长或没有后半时视为不符合约定，整段当图说。
function splitAlt(alt, where, altTitleSep, endPunct, titleMaxLen) {
  const cut = alt.indexOf(altTitleSep);
  if (cut === -1) {
    note(`${where}：alt 里没有分隔符，无法拆出图题，将整段作为图说`);
    return { title: '', desc: alt };
  }
  const title = alt.slice(0, cut);
  const desc = alt.slice(cut + 1).trim();
  if (!desc || title.length > titleMaxLen) {
    note(`${where}：图题 ${title.length} 字、图说 ${desc.length} 字，不符合“首句即图题”的约定，已回退为整段图说`);
    return { title: '', desc: alt };
  }
  // 原 alt 的末句常常没有句号，图注里要补上，否则渲染出来断在半句。
  const ended = endPunct.test(desc) ? desc : `${desc}${altTitleSep}`;
  return { title, desc: ended };
}

function splitCaption(caption, where, captionPrefix, sourceMarkers, sourceEndPunct) {
  const body = caption.replace(new RegExp(`^${escapeRegExp(captionPrefix)}\\s*`), '').trim();
  const marker = sourceMarkers.map(escapeRegExp).join('|');
  const m = body.match(new RegExp(`^(.*?)(?:${marker})\\s*\\[(\\d+)\\]${escapeRegExp(sourceEndPunct)}?$`));
  if (!m) {
    note(`${where}：图注里没有找到“${sourceMarkers.join(' / ')} [n]”，出处将留空`);
    return { note: body, source: null };
  }
  return { note: m[1].trim(), source: Number(m[2]) };
}

// ---------- 章节 ----------

function syncChapter(file, index, locale) {
  const chapter = chapterByNumber(index);
  if (!chapter) {
    note(`${locale.id}：${file}：src/lib/chapters.ts 里没有第 ${index} 章的记录`);
    return null;
  }
  const raw = readFileSync(join(REPO, locale.bookDir, file), 'utf8');
  const h1 = raw.match(/^#\s+(.+)$/m);
  if (!h1) {
    note(`${locale.id}：${file}：找不到一级标题，无法生成 title`);
    return null;
  }
  const title = h1[1].trim();
  const expected = locale.titleFor(chapter);
  if (title !== expected) note(`${locale.id}：${file}：一级标题“${title}”与 chapters.ts 里的“${expected}”不一致`);
  const body = raw.replace(/^#\s+.+$/m, '').replace(/^\n+/, '');

  const refSplit = body.split(new RegExp(`^##\\s*${escapeRegExp(locale.refHeading)}\\s*$`, 'm'));
  if (refSplit.length !== 2) note(`${locale.id}：${file}：找不到唯一的“## ${locale.refHeading}”小节`);
  let main = refSplit[0];
  const refText = refSplit[1] ?? '';

  // 抽图：图片行加紧随的“图注：”段落，整体换成 <Figure />
  const imports = [];
  let figureCount = 0;
  const figureRe = new RegExp(
    `^!\\[([^\\]]*)\\]\\(([^)]+)\\)\\s*\\n+(${escapeRegExp(locale.captionPrefix)}[^\\n]*)$`,
    'gm',
  );
  main = main.replace(figureRe, (whole, alt, src, caption) => {
    figureCount += 1;
    const id = `fig${figureCount}`;
    const number = `${index}-${figureCount}`;
    const where = `${locale.id} ${file} 图 ${number}`;
    const { title: figTitle, desc } = splitAlt(alt, where, locale.altTitleSep, locale.endPunct, locale.titleMaxLen);
    const { note: figNote, source } = splitCaption(caption, where, locale.captionPrefix, locale.sourceMarker, locale.sourceEndPunct);
    // 源文件用 ../images/x 引用共用图片；生成页里图片复制在 ./images/ 下，这里统一归一化。
    if (!existsSync(join(REPO, locale.bookDir, src))) note(`${locale.id}：${file}：图源文件不存在：${src}`);
    imports.push(`import ${id} from './images/${basename(src)}';`);
    const props = [
      `src={${id}}`,
      figTitle ? `title="${escapeAttr(figTitle)}"` : null,
      `desc="${escapeAttr(desc)}"`,
      `number="${number}"`,
      `figcaption="${escapeAttr(figNote)}"`,
      source === null ? null : `source={${source}}`,
    ].filter(Boolean);
    return `<Figure ${props.join(' ')} />`;
  });

  const missingCaption = new RegExp(`^!\\[[^\\]]*\\]\\([^)]+\\)\\s*$`, 'm').test(main);
  if (missingCaption) note(`${locale.id}：${file}：有图片没有紧跟“${locale.captionPrefix}”段落`);

  const cited = new Set();
  main = convertCitations(main, cited).trimEnd();

  const refs = refText.trim()
    ? `\n\n## ${locale.refHeading}\n\n${renderReferences(refText, cited, locale.backTitle)}\n`
    : '\n';
  if (cited.size > 0 && !refText.trim()) note(`${locale.id}：${file}：正文引用了编号但没有“## ${locale.refHeading}”小节`);

  const date = gitDate(join(locale.bookDir, file));
  const fm = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(firstParagraph(main.replace(/<[^>]+>/g, ''), locale.captionPrefix))}`,
    date ? `lastUpdated: ${date}` : null,
    `editUrl: ${EDIT_BASE}/${locale.bookDir}/${file}`,
    '---',
  ].filter(Boolean);

  const out = [
    ...fm,
    '',
    `import Figure from '${locale.importPrefix}/Figure.astro';`,
    `import Cite from '${locale.importPrefix}/Cite.astro';`,
    ...imports,
    '',
    main,
    refs,
  ].join('\n');

  const docsDir = join(DOCS, locale.docsDir);
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, `${chapter.slug}.mdx`), out);
  return { file, locale: locale.id, slug: chapter.slug, title, figures: figureCount, citations: cited.size, refs: refText.trim() ? 'yes' : 'no' };
}

// ---------- 图片 ----------

function copyImages(locale) {
  const from = join(BOOK, 'images');
  const to = join(DOCS, locale.docsDir, 'images');
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

// 章节页面每次重建。旧的编号文件名不会自己消失，先清掉，避免留下失效路由。
for (const locale of LOCALES) {
  const docsDir = join(DOCS, locale.docsDir);
  mkdirSync(docsDir, { recursive: true });
  for (const name of readdirSync(docsDir)) {
    if (name.endsWith('.mdx')) rmSync(join(docsDir, name), { force: true });
  }
}

for (const locale of LOCALES) {
  const chapterFiles = readdirSync(join(REPO, locale.bookDir))
    .filter((f) => /^chapter\d+\.md$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (chapterFiles.length === 0) note(`${locale.id}：${locale.bookDir}/ 下没有找到 chapterN.md`);

  const chapters = chapterFiles.map((f, i) => syncChapter(f, i + 1, locale)).filter(Boolean);
  const images = copyImages(locale);

  console.log(`${locale.id} 同步完成：${chapters.length} 章、图片 ${images.total} 张（复制 ${images.copied}，跳过 ${images.skipped}）`);
  for (const c of chapters) console.log(`  ${c.file} → ${locale.docsDir}/${c.slug}.mdx：${c.title}｜图 ${c.figures}｜引用 ${c.citations} 个编号`);
}

// 根目录里遗留的旧文件（历史上曾用过 outline.md / sources.md）一并清掉。
for (const filename of ['outline.md', 'sources.md']) {
  rmSync(join(DOCS, filename), { force: true });
}

if (problems.length) {
  console.error(`\n发现 ${problems.length} 处问题：`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
