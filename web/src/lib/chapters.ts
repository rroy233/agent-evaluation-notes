// 章节编号、URL slug 和标题的唯一来源。
// 页面生成、侧边栏、内部章节键和验收脚本都从这里取，避免五处各写一份。
export interface Chapter {
  n: number;
  slug: string;
  title: string;
}

export const CHAPTERS: Chapter[] = [
  { n: 1, slug: 'agent-success-criteria', title: 'Agent 的成功标准' },
  { n: 2, slug: 'evaluation-task-design', title: '测评任务设计' },
  { n: 3, slug: 'grader-design', title: '判定器设计' },
  { n: 4, slug: 'eval-set-and-results', title: '组织测评集并解读实验结果' },
  { n: 5, slug: 'production-feedback-and-evolution', title: '生产反馈与测评集演进' },
];

export function chapterByNumber(n: number): Chapter | undefined {
  return CHAPTERS.find((c) => c.n === n);
}

export function chapterBySlug(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}
