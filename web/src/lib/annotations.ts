// 划重点的数据模型与锚定算法。纯函数，不碰 DOM，方便单独测试。
//
// 定位策略：先按引文找出全部出现位置，再用前后文筛；
// 只有一个候选才认，否则判为未匹配。宁可标为未匹配，也不把高亮画到另一句话上。

export const ANNOTATION_FORMAT = 'agent-evaluation-notes-highlights';
export const BACKUP_VERSION = 2;
/** 前后文各取多少字，用于区分重复出现的同一句话 */
export const CONTEXT_LENGTH = 64;
export const MAX_QUOTE_LENGTH = 10000;

export interface Annotation {
  id: string;
  /** 版本与章节的组合键，例如 agent-evaluation-notes:zh-CN:agent-success-criteria */
  chapter: string;
  quote: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  createdAt: string;
}

/**
 * 在正文文本里定位一条划重点。
 * 引文出现多处时用前后文筛；筛不出唯一解就返回 null，调用方按未匹配处理。
 */
export function anchor(text: string, item: Annotation): { start: number; end: number } | null {
  const matches: number[] = [];
  let index = text.indexOf(item.quote);
  while (index !== -1) {
    matches.push(index);
    index = text.indexOf(item.quote, index + 1);
  }
  const contextual = matches.filter(
    (start) =>
      text.slice(0, start).endsWith(item.prefix) &&
      text.slice(start + item.quote.length).startsWith(item.suffix),
  );
  const start = contextual.length === 1 ? contextual[0] : matches.length === 1 ? matches[0] : undefined;
  return start === undefined ? null : { start, end: start + item.quote.length };
}

/** 备份文件在整份校验通过之前不写入任何一条记录。 */
export function parseBackup(value: unknown, expectedChapter: string): Annotation[] {
  const data = value as { format?: unknown; version?: unknown; highlights?: unknown } | null;
  if (
    !data ||
    data.format !== ANNOTATION_FORMAT ||
    (data.version !== 1 && data.version !== BACKUP_VERSION) ||
    !Array.isArray(data.highlights)
  ) {
    throw new Error('请选择由本站导出的高亮备份文件。');
  }
  return data.highlights.map((item: unknown) => {
    const a = item as Annotation | null;
    if (
      !a ||
      typeof a.id !== 'string' ||
      !a.id.length ||
      a.id.length > 100 ||
      a.chapter !== expectedChapter ||
      typeof a.quote !== 'string' ||
      !a.quote.trim() ||
      a.quote.length > MAX_QUOTE_LENGTH ||
      typeof a.prefix !== 'string' ||
      a.prefix.length > CONTEXT_LENGTH ||
      typeof a.suffix !== 'string' ||
      a.suffix.length > CONTEXT_LENGTH ||
      !Number.isSafeInteger(a.start) ||
      a.start < 0 ||
      !Number.isSafeInteger(a.end) ||
      a.end - a.start !== a.quote.length ||
      typeof a.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(a.createdAt))
    ) {
      throw new Error('备份里有一条高亮不合法，或属于别的章节。没有导入任何内容。');
    }
    return {
      id: a.id,
      chapter: a.chapter,
      quote: a.quote,
      prefix: a.prefix,
      suffix: a.suffix,
      start: a.start,
      end: a.end,
      createdAt: a.createdAt,
    };
  });
}

/** 同一条引文：章节、引文、前后文都一致。 */
export function samePassage(a: Annotation, b: Annotation): boolean {
  return a.chapter === b.chapter && a.quote === b.quote && a.prefix === b.prefix && a.suffix === b.suffix;
}

/**
 * 合并导入的备份。返回需要写库的条目。
 * 同一段引文已经存在就跳过，不重复也不覆盖。
 */
export function mergeBackup(existing: Annotation[], imported: Annotation[], makeId: () => string): Annotation[] {
  const all = [...existing];
  const changes = new Map<string, Annotation>();
  for (const item of imported) {
    if (all.some((record) => samePassage(record, item))) continue;
    const merged = { ...item, id: item.id && !all.some((r) => r.id === item.id) ? item.id : makeId() };
    all.push(merged);
    changes.set(merged.id, merged);
  }
  return [...changes.values()];
}
