// 章节键：把 URL 路径映射成稳定的标识，用于限定划重点的作用范围。
// 全站只有这一处生成键，保证写入和读取用的是同一个值。
import { chapterBySlug } from './chapters';

export const BOOK_ID = 'agent-evaluation-notes';
/** 内容语种，参与章节键的组成 */
export const EDITION = 'zh-CN';

export function chapterKeyFromPath(pathname: string): string | null {
  const match = pathname.match(/\/chapters\/([^/]+)\/?$/);
  const chapter = match ? chapterBySlug(match[1]) : undefined;
  return chapter ? `${BOOK_ID}:${EDITION}:${chapter.slug}` : null;
}

/** 划重点按「书 + 语种 + 章节」限定范围，键里三段都要对上。 */
export function sameChapter(a: string, b: string): boolean {
  return a === b;
}
