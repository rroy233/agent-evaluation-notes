// 章页的划重点。
//
// 三处关键做法：
// 1. 渲染时把一段正文按所有高亮区间的边界一次性切开，重叠的高亮共用同一个 <mark>，
//    不是各画各的。逐个包裹会在重叠时把 DOM 拆坏。
// 2. 选区用 selectionchange 跟踪，键盘和触摸选择同样覆盖。
// 3. 删除时把数据库里读到的那份内容交给撤销，撤销用新的 id 写回。
import { anchor, parseBackup, samePassage, type Annotation } from '../lib/annotations';
import { chapterKeyFromPath } from '../lib/chapter-key';
import {
  importHighlights,
  openHighlights,
  readHighlights,
  removeHighlight,
  serialiseBackup,
  writeHighlights,
} from '../lib/highlight-store';

// 划重点覆盖章节正文。这里只排除真正不该划的区域：
// 代码块、图、按钮、脚注。引用标记（[1]）是正文的一部分，绝不能排除，
// 否则选中任何一句带引用的话都会被判为无效选区，工具条根本出不来。
const EXCLUDED = 'pre, figure, button, script, style, .footnotes, .katex';
const CONTEXT = 64;
const MAX_QUOTE = 10000;
let activeController: AbortController | undefined;

export async function initHighlights(): Promise<void> {
  activeController?.abort();
  activeController = new AbortController();
  const { signal } = activeController;

  const content = document.querySelector<HTMLElement>('.sl-markdown-content');
  const chapter = chapterKeyFromPath(location.pathname);
  if (!content || !chapter) return;

  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const toggle = get<HTMLButtonElement>('open-highlights');
  const dialog = get<HTMLDialogElement>('highlights-dialog');
  const toolbar = get<HTMLDivElement>('highlight-selection');
  const save = get<HTMLButtonElement>('save-highlight');
  const list = get<HTMLOListElement>('highlights-list');
  const status = get<HTMLParagraphElement>('highlight-status');
  const dialogStatus = get<HTMLParagraphElement>('highlight-dialog-status');
  const exportButton = get<HTMLButtonElement>('export-highlights');
  const importInput = get<HTMLInputElement>('import-highlights');
  const undoPanel = get('highlight-undo');
  const undo = get<HTMLButtonElement>('undo-highlight');

  let db: IDBDatabase | undefined;
  let records: Annotation[] = [];
  const removed: Annotation[] = [];
  let pending: Annotation | null = null;
  let busy = false;
  let selectionHandedOff = false;
  let messageTimer = 0;

  const notify = (message: string) => {
    if (dialog.open) dialogStatus.textContent = message;
    else {
      status.textContent = message;
      clearTimeout(messageTimer);
      messageTimer = window.setTimeout(() => {
        status.textContent = '';
      }, 6000);
    }
  };

  const hideSelection = () => {
    toolbar.hidden = true;
    pending = null;
  };

  function updateUndo() {
    undoPanel.hidden = removed.length === 0;
    get('highlight-undo-message').textContent = removed.length ? `已删除 ${removed.length} 处高亮。` : '';
  }

  /** 正文里的文本节点及其绝对偏移。跳过的区域不参与锚定，偏移与渲染结果一致。 */
  function textMap() {
    const walker = document.createTreeWalker(content!, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        (node.parentElement?.closest(EXCLUDED) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) as number,
    });
    let text = '';
    const nodes: { node: Text; start: number; end: number }[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) {
      const node = current as Text;
      nodes.push({ node, start: text.length, end: text.length + node.length });
      text += node.data;
    }
    return { text, nodes };
  }

  function render() {
    // 先一次性摘掉所有标记再合并文本节点；边删边查会拿到失效的节点。
    content!.querySelectorAll('mark.hl').forEach((mark) => mark.replaceWith(...mark.childNodes));
    content!.normalize();

    const map = textMap();
    const located = records.map((record) => ({ record, position: anchor(map.text, record) }));

    for (const entry of map.nodes) {
      const intervals = located.flatMap(({ position }) =>
        position && position.start < entry.end && position.end > entry.start
          ? [{ start: Math.max(0, position.start - entry.start), end: Math.min(entry.node.length, position.end - entry.start) }]
          : [],
      );
      if (!intervals.length) continue;
      const cuts = [...new Set([0, entry.node.length, ...intervals.flatMap((i) => [i.start, i.end])])].sort((a, b) => a - b);
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < cuts.length - 1; i += 1) {
        const text = document.createTextNode(entry.node.data.slice(cuts[i], cuts[i + 1]));
        const covering = located.filter(
          ({ position }) =>
            position && position.start <= entry.start + cuts[i] && position.end >= entry.start + cuts[i + 1],
        );
        if (!covering.length) {
          fragment.append(text);
          continue;
        }
        const mark = document.createElement('mark');
        mark.className = 'hl';
        mark.dataset.highlightIds = covering.map(({ record }) => record.id).join(' ');
        mark.title = '点击可以删除这处高亮';
        if (!entry.node.parentElement?.closest('a')) {
          mark.tabIndex = 0;
          mark.setAttribute('role', 'button');
        }
        mark.append(text);
        fragment.append(mark);
      }
      entry.node.replaceWith(fragment);
    }

    get('highlight-count').textContent = String(records.length);
    get('highlights-empty').hidden = records.length > 0;
    exportButton.disabled = records.length === 0;

    list.replaceChildren();
    for (const { record, position } of located) {
      const li = document.createElement('li');
      const quote = document.createElement('blockquote');
      quote.textContent = record.quote;
      li.append(quote);

      if (!position) {
        const message = document.createElement('p');
        message.className = 'unmatched';
        message.textContent = '这段原文改动过或找不到了，保存的引文仍然保留。';
        li.append(message);
      }

      const actions = document.createElement('div');
      actions.className = 'highlight-actions';

      const jump = document.createElement('button');
      jump.type = 'button';
      jump.textContent = '跳到原文';
      jump.disabled = !position;
      jump.addEventListener('click', () => {
        const current = textMap();
        const match = anchor(current.text, record);
        if (!match) return;
        const entry = current.nodes.find((n) => n.start <= match.start && n.end > match.start);
        const target = entry?.node.parentElement;
        if (!target) return;
        dialog.close();
        target.scrollIntoView({
          block: 'center',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
        const hadTabindex = target.getAttribute('tabindex');
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.addEventListener(
          'blur',
          () => (hadTabindex === null ? target.removeAttribute('tabindex') : target.setAttribute('tabindex', hadTabindex)),
          { once: true },
        );
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'hl-danger';
      remove.textContent = '删除';
      remove.setAttribute('aria-label', `删除高亮：${record.quote.slice(0, 60)}`);
      remove.addEventListener('click', () => void deleteHighlight(record.id, [...list.children].indexOf(li)));

      actions.append(jump, remove);
      li.append(actions);
      list.append(li);
    }
  }

  async function refresh() {
    if (!db) return;
    records = (await readHighlights(db, chapter)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    render();
  }

  /** 所有会改数据的操作都走这里：串行、禁用按钮、刷新列表、出错给提示。 */
  async function mutate(action: () => Promise<void>, message: string) {
    if (busy || !db) return;
    busy = true;
    save.disabled = true;
    undo.disabled = true;
    try {
      await action();
      hideSelection();
      getSelection()?.removeAllRanges();
      await refresh();
      notify(message);
    } catch {
      notify('这次改动没能保存。浏览器存储可能不可用或已满，请再试一次。');
    } finally {
      busy = false;
      save.disabled = false;
      undo.disabled = false;
    }
  }

  async function deleteHighlight(id: string, rowIndex?: number) {
    await mutate(async () => {
      const deleted = await removeHighlight(db!, id);
      if (deleted) removed.push(deleted);
      updateUndo();
    }, '高亮已删除。');
    if (rowIndex === undefined) return;
    const nextRow = list.children[Math.min(rowIndex, list.children.length - 1)];
    (nextRow?.querySelector('button') ?? get<HTMLButtonElement>('close-highlights')).focus();
  }

  /* ---------- 选区和工具条 ---------- */

  document.addEventListener('selectionchange', () => {
    if (busy || dialog.open || toolbar.contains(document.activeElement)) return;
    const selection = getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) {
      hideSelection();
      return;
    }
    const range = selection.getRangeAt(0);
    if (!content.contains(range.startContainer) || !content.contains(range.endContainer)) {
      hideSelection();
      return;
    }
    // 选区碰到代码块或图就整体放弃，不做部分裁剪
    if ([...content.querySelectorAll(EXCLUDED)].some((node) => range.intersectsNode(node))) {
      hideSelection();
      return;
    }
    const map = textMap();
    const selected = map.nodes.filter(({ node }) => range.intersectsNode(node));
    const first = selected[0];
    const last = selected.at(-1);
    if (!first || !last) {
      hideSelection();
      return;
    }
    let start = first.start + (range.startContainer === first.node ? range.startOffset : 0);
    let end = last.start + (range.endContainer === last.node ? range.endOffset : last.node.length);
    // 选区两端常有空白，按去空白后的区间保存，锚点才对得上
    const raw = map.text.slice(start, end);
    start += raw.length - raw.trimStart().length;
    end -= raw.length - raw.trimEnd().length;
    const quote = map.text.slice(start, end);
    if (!quote.trim() || quote.length > MAX_QUOTE) {
      hideSelection();
      return;
    }
    if (!pending || pending.start !== start || pending.end !== end) selectionHandedOff = false;
    pending = {
      id: crypto.randomUUID(),
      chapter,
      quote,
      start,
      end,
      prefix: map.text.slice(Math.max(0, start - CONTEXT), start),
      suffix: map.text.slice(end, end + CONTEXT),
      createdAt: new Date().toISOString(),
    };
    const rect = range.getBoundingClientRect();
    toolbar.hidden = false;
    toolbar.style.left = `${Math.max(12, Math.min(innerWidth - toolbar.offsetWidth - 12, rect.left + rect.width / 2 - toolbar.offsetWidth / 2))}px`;
    toolbar.style.top = `${Math.max(12, Math.min(innerHeight - toolbar.offsetHeight - 12, rect.top > 140 ? rect.top - toolbar.offsetHeight - 10 : rect.bottom + 10))}px`;
  }, { signal });

  // 点工具条不要清掉选区
  toolbar.addEventListener('pointerdown', (event) => event.preventDefault());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideSelection();
      closeActions();
    }
    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      !selectionHandedOff &&
      pending &&
      !toolbar.hidden &&
      !toolbar.contains(document.activeElement)
    ) {
      event.preventDefault();
      selectionHandedOff = true;
      save.focus();
    }
  }, { signal });
  window.addEventListener('scroll', hideSelection, { passive: true, signal });
  window.addEventListener('resize', hideSelection, { signal });

  save.addEventListener('click', () => {
    const item = pending;
    if (!item) return;
    void mutate(async () => {
      const latest = await readHighlights(db!, chapter);
      // 同一段引文已经存在就不再存一遍
      if (!latest.some((record) => samePassage(record, item))) await writeHighlights(db!, [item]);
    }, '已加入本章高亮，只存在这台浏览器里。');
  });

  /* ---------- 点击高亮：就地删除 ---------- */

  let actions: HTMLElement | null = null;
  const closeActions = () => {
    actions?.remove();
    actions = null;
  };

  function openActions(mark: HTMLElement) {
    closeActions();
    const ids = mark.dataset.highlightIds?.split(' ').filter(Boolean) ?? [];
    if (!ids.length) return;
    actions = document.createElement('div');
    actions.className = 'hl-mark-actions';
    const tip = document.createElement('span');
    tip.textContent = ids.length > 1 ? `这段有 ${ids.length} 处高亮` : '这处高亮';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '删除';
    remove.addEventListener('click', () => {
      for (const id of ids) void deleteHighlight(id);
      closeActions();
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'hl-quiet';
    cancel.textContent = '关闭';
    cancel.addEventListener('click', closeActions);
    actions.append(tip, remove, cancel);
    document.body.append(actions);
    const rect = mark.getBoundingClientRect();
    actions.style.left = `${Math.max(12, Math.min(innerWidth - actions.offsetWidth - 12, rect.left))}px`;
    actions.style.top = `${Math.max(12, Math.min(innerHeight - actions.offsetHeight - 12, rect.bottom + 8))}px`;
  }

  function activateMark(event: MouseEvent | KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('a') || target.closest('.hl-mark-actions')) return;
    const mark = target.closest<HTMLElement>('mark.hl');
    if (!mark) return;
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
    // 点击正文里的高亮一律给出删除入口。这里不看有没有残留选区，
    // 否则拖动选中之后的一次点击会被静默吞掉。
    event.preventDefault();
    hideSelection();
    getSelection()?.removeAllRanges();
    openActions(mark);
  }
  content.addEventListener('click', activateMark);
  content.addEventListener('keydown', activateMark);
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('mark.hl') && !target?.closest('.hl-mark-actions')) closeActions();
  }, { signal });
  window.addEventListener('scroll', closeActions, { passive: true, signal });

  /* ---------- 备份 ---------- */

  exportButton.addEventListener('click', async () => {
    try {
      // 导出前重读一次，其他标签页刚存的也能带上
      const highlights = (await readHighlights(db!, chapter)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const json = serialiseBackup(highlights);
      get<HTMLTextAreaElement>('highlight-backup-json').value = json;
      get('highlight-backup-panel').hidden = false;
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agent-evaluation-notes-${chapter.split(':').at(-1)}-highlights.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      notify('导出失败，请再试一次。');
    }
  });

  get('copy-highlight-backup').addEventListener('click', async () => {
    const output = get<HTMLTextAreaElement>('highlight-backup-json');
    try {
      await navigator.clipboard.writeText(output.value);
      notify('备份已复制，粘贴到 .json 文件里保存即可。');
    } catch {
      output.focus();
      output.select();
      notify('请复制选中的备份文字，保存成 .json 文件。');
    }
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const imported = parseBackup(JSON.parse(await file.text()), chapter);
      await mutate(async () => {
        await importHighlights(db!, imported, chapter);
      }, '备份已导入，已有的高亮保留不变。');
    } catch (error) {
      notify(error instanceof Error ? error.message : '这个备份文件无法导入。');
    } finally {
      importInput.value = '';
    }
  });

  undo.addEventListener('click', async () => {
    const record = removed.at(-1);
    if (!record || busy || !db) return;
    await mutate(async () => {
      // 用新 id 写回，避免覆盖其他标签页里恢复或导入的同一条记录
      await writeHighlights(db!, [{ ...record, id: crypto.randomUUID() }]);
      removed.pop();
      updateUndo();
    }, '高亮已恢复。');
    if (undoPanel.hidden) get('close-highlights').focus();
  });

  /* ---------- 面板开关 ---------- */

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    hideSelection();
    closeActions();
    dialogStatus.textContent = db ? '' : '划重点存储不可用。请允许本站使用存储后刷新再试。';
    dialog.showModal();
  });
  get('close-highlights').addEventListener('click', () => dialog.close());
  exportButton.disabled = true;
  importInput.disabled = true;

  try {
    db = await openHighlights();
    await refresh();
    importInput.disabled = false;
  } catch {
    db = undefined;
    notify('划重点加载失败。请允许浏览器存储后刷新再试。');
    return;
  }

  // 其他标签页可能改了数据，回到本页时重读一次
  window.addEventListener('focus', () => {
    if (!busy && !pending && !dialog.open) refresh().catch(() => notify('重新读取高亮失败，请刷新页面。'));
  }, { signal });

  document.documentElement.dataset.highlighter = 'on';
}
