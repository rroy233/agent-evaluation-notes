// 选区工具条的摆放几何。
//
// 单独放在这里是为了能脱离 DOM 直接验证：延迟、上方/下方择优、视口收口都是纯计算，
// 浏览器里量到的只是输入。
export const TOOLBAR_GAP = 10;
export const TOOLBAR_EDGE = 12;

export interface ToolbarBox {
  width: number;
  height: number;
}

export interface ViewportBox {
  width: number;
  height: number;
}

/**
 * 把工具条摆在选区上方或下方，取两者中更好的一个。
 *
 * 输入和返回值都是视口坐标；调用方负责把返回值换算成自己元素的坐标。
 * 择优标准按重要性排序：
 *   1. 不遮住选中的文字（压住选区是唯一会挡住阅读的失败）；
 *   2. 尽量完整落在视口里（两个候选都会越界时，越界少的优先）；
 *   3. 在同样不遮字的情况下，按「上方优先」取更靠上的那个。
 */
export function placeToolbar(
  selection: { top: number; bottom: number; left: number; width: number },
  toolbar: ToolbarBox,
  viewport: ViewportBox,
  options: { gap?: number; edge?: number } = {},
): { top: number; left: number } {
  const gap = options.gap ?? TOOLBAR_GAP;
  const edge = options.edge ?? TOOLBAR_EDGE;

  // 两个候选位置：贴选区上沿外侧、贴选区下沿外侧，各自再收进视口
  const clampTop = (value: number) =>
    Math.min(Math.max(value, edge), Math.max(edge, viewport.height - toolbar.height - edge));
  const candidates = [selection.top - gap - toolbar.height, selection.bottom + gap].map(clampTop);

  const score = (top: number) => {
    const bottom = top + toolbar.height;
    const covered = Math.max(0, Math.min(bottom, selection.bottom) - Math.max(top, selection.top));
    const spill = Math.max(0, edge - top) + Math.max(0, bottom - (viewport.height - edge));
    return [covered, spill, top];
  };
  const [best] = candidates.sort((a, b) => {
    const [ca, sa, ta] = score(a);
    const [cb, sb, tb] = score(b);
    return ca - cb || sa - sb || ta - tb;
  });

  const maxLeft = Math.max(edge, viewport.width - toolbar.width - edge);
  const centered = selection.left + selection.width / 2 - toolbar.width / 2;
  return {
    top: best,
    left: Math.min(maxLeft, Math.max(edge, centered)),
  };
}
