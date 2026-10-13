// 顶栏主题下拉：替代 Starlight 默认的原生 select。
// 偏好仍存在 localStorage 的 starlight-theme（'' 表示跟随系统），与 Starlight 的约定一致，
// 这样已有的用户选择不会丢。
import { closeDropdown } from './dropdown';

const STORAGE_KEY = 'starlight-theme';
const BOUND_KEY = '__starlightThemeDropdownAbort';
type Theme = 'auto' | 'dark' | 'light';
type BoundWindow = Window & { [BOUND_KEY]?: AbortController };

const parseTheme = (value: unknown): Theme => (value === 'light' || value === 'dark' ? value : 'auto');

function loadTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme === 'auto' ? '' : theme);
  } catch {
    /* 隐私模式下写不进去，忽略 */
  }
}

const systemPrefers = (): 'light' | 'dark' =>
  matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

/** 把偏好解析成实际要用的明暗。 */
const resolveTheme = (theme: Theme): 'light' | 'dark' => (theme === 'auto' ? systemPrefers() : theme);

function labelOf(root: HTMLElement, theme: Theme): string {
  if (theme === 'light') return root.dataset.labelLight ?? '';
  if (theme === 'dark') return root.dataset.labelDark ?? '';
  return root.dataset.labelAuto ?? '';
}

/** 把当前偏好同步到触发器的图标、文字和菜单选中项。 */
export function syncThemeDropdowns(theme: Theme = loadTheme()): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-theme-dropdown]')) {
    root.dataset.themePref = theme;
    const label = root.querySelector<HTMLElement>('[data-theme-label]');
    if (label) label.textContent = labelOf(root, theme);
    for (const item of root.querySelectorAll<HTMLElement>('[data-theme-option]')) {
      if (item.dataset.themeOption === theme) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    }
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
  storeTheme(theme);
  syncThemeDropdowns(theme);
}

export function initThemeDropdown(): void {
  const win = window as BoundWindow;
  win[BOUND_KEY]?.abort();
  const controller = new AbortController();
  win[BOUND_KEY] = controller;
  const { signal } = controller;

  syncThemeDropdowns();

  // ClientRouter 换页时，新页面服务端渲染的 data-theme 会覆盖用户的选择。
  // 在 before-swap 里直接改即将插入的文档，换上去就是对的，不会闪一下。
  document.addEventListener(
    'astro:before-swap',
    (event) => {
      const next = (event as Event & { newDocument?: Document }).newDocument;
      if (next) next.documentElement.dataset.theme = resolveTheme(loadTheme());
    },
    { signal },
  );

  // 兜底：换页后立刻再纠正一次（也顺带同步触发器上的图标和文字）。
  document.addEventListener(
    'astro:after-swap',
    () => {
      document.documentElement.dataset.theme = resolveTheme(loadTheme());
      syncThemeDropdowns();
    },
    { signal },
  );

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const option = target?.closest<HTMLElement>('[data-theme-option]');
      if (!option) return;
      applyTheme(parseTheme(option.dataset.themeOption));
      closeDropdown(option);
    },
    { signal },
  );

  // 跟随系统偏好变化：只有「自动」时才需要重新应用。
  matchMedia('(prefers-color-scheme: light)').addEventListener(
    'change',
    () => {
      if (loadTheme() === 'auto') applyTheme('auto');
    },
    { signal },
  );
}
