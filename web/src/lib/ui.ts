// 站点自定义界面文案的唯一来源，按语种（BCP-47 lang）取用。
// 组件在服务端用 Astro.locals.starlightRoute.lang 取，浏览器脚本用 document.documentElement.lang 取。
export type UiLang = 'zh-CN' | 'en';

export interface LoopStep {
  label: string;
  desc: string;
}

export interface UiStrings {
  // Figure
  figureEnlarge: (alt: string) => string;
  figureNumber: (n: string) => string;
  figureSource: string;
  // Cite
  citeJump: (n: number) => string;
  // ReadingTools
  progressAria: string;
  fontGroup: string;
  fontSmaller: string;
  fontLarger: string;
  focusOn: string;
  focusOff: string;
  focusTitle: string;
  // ReaderOverlays
  viewerAria: string;
  zoomOut: string;
  zoomIn: string;
  fitWidth: string;
  openOriginal: string;
  close: string;
  // Highlights（面板与运行时共用）
  highlightsTitle: string;
  selectedText: string;
  highlight: string;
  closeHighlights: string;
  highlightsHelp: string;
  exportBackup: string;
  importBackup: string;
  backupContent: string;
  copyBackup: string;
  backupHelp: string;
  undo: string;
  undoHelp: string;
  highlightsEmpty: string;
  markTitle: string;
  unmatched: string;
  jumpToSource: string;
  delete: string;
  deleteAria: (quote: string) => string;
  deletedCount: (n: number) => string;
  saveFailed: string;
  deleted: string;
  thisHighlight: string;
  multiHighlights: (n: number) => string;
  saved: string;
  exportFailed: string;
  copyDone: string;
  copyManual: string;
  imported: string;
  importNotBackup: string;
  importInvalidEntry: string;
  restored: string;
  storageUnavailable: string;
  loadFailed: string;
  refreshFailed: string;
  // ViewCount
  adBlockHint: string;
  articleReads: string;
  views: string;
  times: string;
  // AgentLoop（首页）
  loopSteps: LoopStep[];
  loopCount: (i: number, total: number) => string;
  // ReferenceDeck（首页）
  deckAria: string;
  openSource: (title: string) => string;
  authorPrefix: string;
}

const zh: UiStrings = {
  figureEnlarge: (alt) => `放大查看：${alt}`,
  figureNumber: (n) => `图 ${n}`,
  figureSource: '图片来自',
  citeJump: (n) => `跳转到参考文献 ${n}`,
  progressAria: '本页阅读进度',
  fontGroup: '字号',
  fontSmaller: '减小字号',
  fontLarger: '增大字号',
  focusOn: '专注',
  focusOff: '退出专注',
  focusTitle: '专注模式：隐藏导航，只留正文',
  viewerAria: '图片查看器',
  zoomOut: '缩小',
  zoomIn: '放大',
  fitWidth: '适应宽度',
  openOriginal: '打开原图',
  close: '关闭',
  highlightsTitle: '本章高亮',
  selectedText: '选中的文字',
  highlight: '高亮',
  closeHighlights: '关闭本章高亮',
  highlightsHelp: '选中正文里的文字，工具条上点「高亮」即可。点击正文里的高亮可以就地删除。清除浏览器数据或换设备之前，先导出一份备份。',
  exportBackup: '导出备份',
  importBackup: '导入备份',
  backupContent: '备份内容',
  copyBackup: '复制备份',
  backupHelp: '下载没有自动开始的话，把这段内容复制到 .json 文件里保存。',
  undo: '撤销',
  undoHelp: '撤销只在离开或刷新本页之前有效。',
  highlightsEmpty: '还没有划重点。保存过的段落会出现在这里。',
  markTitle: '点击可以删除这处高亮',
  unmatched: '这段原文改动过或找不到了，保存的引文仍然保留。',
  jumpToSource: '跳到原文',
  delete: '删除',
  deleteAria: (quote) => `删除高亮：${quote}`,
  deletedCount: (n) => `已删除 ${n} 处高亮。`,
  saveFailed: '这次改动没能保存。浏览器存储可能不可用或已满，请再试一次。',
  deleted: '高亮已删除。',
  thisHighlight: '这处高亮',
  multiHighlights: (n) => `这段有 ${n} 处高亮`,
  saved: '已加入本章高亮，只存在这台浏览器里。',
  exportFailed: '导出失败，请再试一次。',
  copyDone: '备份已复制，粘贴到 .json 文件里保存即可。',
  copyManual: '请复制选中的备份文字，保存成 .json 文件。',
  imported: '备份已导入，已有的高亮保留不变。',
  importNotBackup: '请选择由本站导出的高亮备份文件。',
  importInvalidEntry: '备份里有一条高亮不合法，或属于别的章节。没有导入任何内容。',
  restored: '高亮已恢复。',
  storageUnavailable: '划重点存储不可用。请允许本站使用存储后刷新再试。',
  loadFailed: '划重点加载失败。请允许浏览器存储后刷新再试。',
  refreshFailed: '重新读取高亮失败，请刷新页面。',
  adBlockHint: '广告拦截器会影响统计',
  articleReads: '本文阅读',
  views: '浏览',
  times: ' 次',
  loopSteps: [
    { label: '成功标准', desc: '先写清判断 Agent 好坏的依据：量什么、凭什么量、算不算成功。' },
    { label: '测评任务', desc: '把标准写成可重复执行的任务：输入、环境、预期结果和行为约束。' },
    { label: '判定器', desc: '定下谁来读证据、凭什么判定通过，并用人工标注校准判定质量。' },
    { label: '测评集与结果', desc: '把任务和判定器组织成测评集，固定条件跑实验，读懂版本之间的差异。' },
    { label: '发布与问题回收', desc: '用结果决定是否发布，再把线上发现的问题转成新的测评任务，补回第一步。' },
  ],
  loopCount: (i, total) => `第 ${i} 步，共 ${total} 步`,
  deckAria: '文章卡片轮播',
  openSource: (title) => `打开 ${title} 原文`,
  authorPrefix: '作者 · ',
};

const en: UiStrings = {
  figureEnlarge: (alt) => `Enlarge: ${alt}`,
  figureNumber: (n) => `Fig. ${n}`,
  figureSource: 'Image from',
  citeJump: (n) => `Jump to reference ${n}`,
  progressAria: 'Reading progress',
  fontGroup: 'Font size',
  fontSmaller: 'Smaller text',
  fontLarger: 'Larger text',
  focusOn: 'Focus',
  focusOff: 'Exit focus',
  focusTitle: 'Focus mode: hide navigation, show only the text',
  viewerAria: 'Image viewer',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  fitWidth: 'Fit width',
  openOriginal: 'Open original',
  close: 'Close',
  highlightsTitle: 'Highlights in this chapter',
  selectedText: 'Selected text',
  highlight: 'Highlight',
  closeHighlights: 'Close highlights',
  highlightsHelp: 'Select text in the article, then click “Highlight” on the toolbar. Click a highlight in the text to remove it. Export a backup before clearing browser data or switching devices.',
  exportBackup: 'Export backup',
  importBackup: 'Import backup',
  backupContent: 'Backup contents',
  copyBackup: 'Copy backup',
  backupHelp: 'If the download didn’t start, copy this content into a .json file and save it.',
  undo: 'Undo',
  undoHelp: 'Undo only works until you leave or refresh this page.',
  highlightsEmpty: 'No highlights yet. Saved passages will appear here.',
  markTitle: 'Click to remove this highlight',
  unmatched: 'This passage was edited or can no longer be found; the saved quote is kept.',
  jumpToSource: 'Jump to source',
  delete: 'Delete',
  deleteAria: (quote) => `Delete highlight: ${quote}`,
  deletedCount: (n) => `Removed ${n} highlight${n === 1 ? '' : 's'}.`,
  saveFailed: 'Couldn’t save this change. Browser storage may be unavailable or full; try again.',
  deleted: 'Highlight removed.',
  thisHighlight: 'This highlight',
  multiHighlights: (n) => `${n} highlights on this passage`,
  saved: 'Added to this chapter’s highlights; stored only in this browser.',
  exportFailed: 'Export failed; try again.',
  copyDone: 'Backup copied; paste it into a .json file and save.',
  copyManual: 'Copy the selected backup text and save it as a .json file.',
  imported: 'Backup imported; existing highlights are kept.',
  importNotBackup: 'Choose a highlight backup file exported by this site.',
  importInvalidEntry: 'A highlight in the backup is invalid or belongs to another chapter. Nothing was imported.',
  restored: 'Highlight restored.',
  storageUnavailable: 'Highlight storage is unavailable. Allow this site to use storage, then refresh and try again.',
  loadFailed: 'Couldn’t load highlights. Allow browser storage, then refresh and try again.',
  refreshFailed: 'Couldn’t reload highlights; refresh the page.',
  adBlockHint: 'Ad blockers can affect the count',
  articleReads: 'reads',
  views: 'views',
  times: '',
  loopSteps: [
    { label: 'Success criteria', desc: 'Write down what makes an agent good: what to measure, what evidence counts, and what counts as success.' },
    { label: 'Eval tasks', desc: 'Turn criteria into repeatable tasks: inputs, environment, expected results, and behavioral constraints.' },
    { label: 'Graders', desc: 'Decide who reads the evidence and what counts as a pass, and calibrate grading quality with human labels.' },
    { label: 'Eval sets & results', desc: 'Organize tasks and graders into eval sets, run experiments under fixed conditions, and read version differences.' },
    { label: 'Release & feedback', desc: 'Use results to decide whether to ship, then turn issues found online into new eval tasks and loop back to step one.' },
  ],
  loopCount: (i, total) => `Step ${i} of ${total}`,
  deckAria: 'Article card carousel',
  openSource: (title) => `Open the source for ${title}`,
  authorPrefix: 'By ',
};

export function ui(lang: string | undefined | null): UiStrings {
  return lang === 'en' ? en : zh;
}
