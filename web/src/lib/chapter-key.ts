// 章节键：把 URL 路径映射成稳定的标识，用于限定划重点的作用范围。
// 全站只有这一处生成键，保证写入和读取用的是同一个值。
import { chapterBySlug } from './chapters';

export const BOOK_ID = 'agent-evaluation-notes';

export function chapterKeyFromPath(pathname: string): string | null {
  const match = pathname.match(/\/(?:en\/)?chapters\/([^/]+)\/?$/);
  const chapter = match ? chapterBySlug(match[1]) : undefined;
  if (!chapter) return null;
  // 内容语种参与章节键的组成，中文与英文版的高亮各自独立。
  const edition = pathname.includes('/en/') ? 'en' : 'zh-CN';
  return `${BOOK_ID}:${edition}:${chapter.slug}`;
}

/** 划重点按「书 + 语种 + 章节」限定范围，键里三段都要对上。 */
export function sameChapter(a: string, b: string): boolean {
  return a === b;
}
