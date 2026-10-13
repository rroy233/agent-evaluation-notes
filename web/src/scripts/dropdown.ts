// 顶栏自定义下拉：按钮开合浮层。用事件委托，ClientRouter 换页后不用重绑。
// 每次初始化先中止上一次的监听，脚本被重复执行也不会叠加。

const BOUND_KEY = '__starlightNavDropdownAbort';
type BoundWindow = Window & { [BOUND_KEY]?: AbortController };

function panelOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-dropdown-panel]');
}

function setOpen(root: HTMLElement, open: boolean): void {
  const panel = panelOf(root);
  const trigger = root.querySelector<HTMLElement>('[data-dropdown-trigger]');
  if (!panel || !trigger) return;
  panel.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  if (open) root.dataset.dropdownOpen = '';
  else delete root.dataset.dropdownOpen;
}

function closeAll(except: Element | null): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-dropdown]')) {
    if (root !== except) setOpen(root, false);
  }
}

/** 关闭某个下拉。选项自己处理完点击后调用。 */
export function closeDropdown(el: Element): void {
  const root = el.closest<HTMLElement>('[data-dropdown]');
  if (root) setOpen(root, false);
}

export function initDropdowns(): void {
  const win = window as BoundWindow;
  win[BOUND_KEY]?.abort();
  const controller = new AbortController();
  win[BOUND_KEY] = controller;
  const { signal } = controller;

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const trigger = target.closest<HTMLElement>('[data-dropdown-trigger]');
      if (trigger) {
        const root = trigger.closest<HTMLElement>('[data-dropdown]');
        if (!root) return;
        const willOpen = panelOf(root)?.hidden ?? false;
        closeAll(root);
        setOpen(root, willOpen);
        return;
      }

      const panel = target.closest<HTMLElement>('[data-dropdown-panel]');
      if (panel) {
        // 点链接就跳走了，先收起来；点按钮选项则由组件自己关闭，这里不抢。
        if (target.closest('a')) closeAll(null);
        else closeAll(panel.closest<HTMLElement>('[data-dropdown]'));
        return;
      }

      closeAll(null);
    },
    { signal },
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      const open = document.querySelector<HTMLElement>('[data-dropdown-open]');
      if (!open) return;
      setOpen(open, false);
      open.querySelector<HTMLElement>('[data-dropdown-trigger]')?.focus();
    },
    { signal },
  );
}
