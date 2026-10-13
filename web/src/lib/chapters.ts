// 章节编号、URL slug 和标题的唯一来源。
// 页面生成、侧边栏、内部章节键和验收脚本都从这里取，避免五处各写一份。
// title 按语种（BCP-47 lang）分别给出；slug 跨语种共享，用于 hreflang 互认。
export interface Chapter {
  n: number;
  slug: string;
  title: { 'zh-CN': string; en: string };
}

export const CHAPTERS: Chapter[] = [
  { n: 1, slug: 'agent-success-criteria', title: { 'zh-CN': 'Agent 的成功标准', en: 'Success Criteria for Agents' } },
  { n: 2, slug: 'evaluation-task-design', title: { 'zh-CN': '测评任务设计', en: 'Designing Evaluation Tasks' } },
  { n: 3, slug: 'grader-design', title: { 'zh-CN': '判定器设计', en: 'Grader Design' } },
  { n: 4, slug: 'eval-set-and-results', title: { 'zh-CN': '组织测评集并解读实验结果', en: 'Organizing Evaluation Suites and Interpreting Experimental Results' } },
  { n: 5, slug: 'production-feedback-and-evolution', title: { 'zh-CN': '生产反馈与测评集演进', en: 'Production Feedback and Evaluation-Suite Evolution' } },
];

export function chapterByNumber(n: number): Chapter | undefined {
  return CHAPTERS.find((c) => c.n === n);
}

export function chapterBySlug(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}
