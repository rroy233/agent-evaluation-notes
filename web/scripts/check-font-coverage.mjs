// 核对字形覆盖：正文、界面文案和渲染产物里出现的字符，必须都在已发布的字体子集里。
// dist/ 存在时连构建产物一起核，能抓到渲染器自己产出的字形。
// 缺字直接失败并列出缺哪些字，避免读者看到方框。
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..');
const cfg = JSON.parse(readFileSync(join(WEB, 'fonts.config.json'), 'utf8'));

const manifestPath = join(WEB, 'font-coverage.json');
if (!existsSync(manifestPath)) {
  console.error('缺少 font-coverage.json。先执行：');
  console.error('  node dev/fetch-fonts.mjs && python3 dev/subset-fonts.py');
  process.exit(1);
}
const covered = new Set(JSON.parse(readFileSync(manifestPath, 'utf8')).union);

// 字形集以「实际会渲染出来的文字」为准，不从 src/ 源码里取：
// CSS 和 TS 里的中文注释永远不渲染，取进来只会误报。
// 动态生成的界面文案（提示条、查看器按钮）从打包后的 JS 里取中文。
const isCjk = (ch) => {
  const cp = ch.codePointAt(0);
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xff00 && cp <= 0xffef);
};

// 遍历目录取文件。跳过 node_modules、dist 以外的生成物等无关目录。
const SKIP_DIR = /(node_modules|\/\.astro\/|\/\.fonts-src\/|pnpm-lock\.yaml)/;
function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP_DIR.test(p) || name === 'node_modules') continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const need = new Map();
function add(text, where) {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || cp === 0x7f) continue;
    if (!need.has(ch)) need.set(ch, where);
  }
}

// 1) 正文
for (const p of walk(join(REPO, 'book'))) if (extname(p) === '.md') add(readFileSync(p, 'utf8'), p.slice(REPO.length + 1));

// 2) Starlight 的中文界面文案
const zh = join(WEB, 'node_modules/@astrojs/starlight/dist/translations/zh-CN.js');
if (existsSync(zh)) add(readFileSync(zh, 'utf8'), 'Starlight zh-CN 界面文案');

// 3) 站点自定义文案与渲染字符集
add(cfg.uiText, 'fonts.config.json：uiText');
add(cfg.renderChars, 'fonts.config.json：renderChars');

const beforeBuild = need.size;

// 4) 构建产物：渲染后的 HTML 正文
const dist = join(WEB, 'dist');
let rendered = 0;
if (existsSync(dist)) {
  for (const p of walk(dist)) {
    if (extname(p) === '.js') {
      // 打包脚本里的中文几乎都是界面文案，ASCII 是标识符噪声，只取中文
      for (const ch of readFileSync(p, 'utf8')) if (isCjk(ch)) need.set(ch, `打包脚本 ${p.slice(WEB.length + 1)}`);
      continue;
    }
    if (extname(p) !== '.html') continue;
    const text = readFileSync(p, 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, '\u00a0');
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp < 0x20 || cp === 0x7f) continue;
      rendered += 1;
      if (!need.has(ch)) need.set(ch, `构建产物 ${p.slice(WEB.length + 1)}`);
    }
  }
}

const missing = [...need.entries()].filter(([ch]) => !covered.has(ch.codePointAt(0)));
const allowed = cfg.knownFallbacks ?? {};
const tolerated = missing.filter(([ch]) => ch in allowed);

console.log(
  `字形覆盖检查：需要 ${need.size} 个字符（源码 ${beforeBuild}${rendered ? `，渲染产物补充` : ''}），子集覆盖 ${covered.size} 个码位`,
);

if (tolerated.length) {
  console.warn(`\n${tolerated.length} 个字符按配置回退到系统字体：`);
  for (const [ch] of tolerated) console.warn(`  ${JSON.stringify(ch)} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}：${allowed[ch]}`);
}

if (missing.length > tolerated.length) {
  const real = missing.filter(([ch]) => !(ch in allowed));
  console.error(`\n有 ${real.length} 个字符不在字体子集里，页面上会显示成方框：`);
  for (const [ch, where] of real.slice(0, 40)) {
    console.error(`  ${JSON.stringify(ch)} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  来自 ${where}`);
  }
  console.error('\n处理方式：node dev/fetch-fonts.mjs && python3 dev/subset-fonts.py，然后提交 public/fonts/。');
  console.error('确实要回退到系统字体的字符，加进 fonts.config.json 的 knownFallbacks 并写明原因。');
  process.exit(1);
}

console.log(`通过。${existsSync(dist) ? '已包含构建产物复核。' : '（dist/ 不存在，只核了源码）'}`);
