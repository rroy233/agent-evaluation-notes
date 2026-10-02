// 图片查看器。用原生 <dialog>，支持分级放大、适应宽度、拖动查看和打开原图。
// 放大时保持视口中心对准图片上的同一个点，不会一跳就跑到左上角。
// 触摸和触控板走原生滚动，只有鼠标拖动才接管。
const ZOOM_LEVELS = [1, 1.5, 2, 3, 4];
let activeController: AbortController | undefined;
let activeResizeObserver: ResizeObserver | undefined;

export function initFigureViewer(): void {
  activeController?.abort();
  activeResizeObserver?.disconnect();
  activeController = new AbortController();
  const { signal } = activeController;

  const dialog = document.querySelector<HTMLDialogElement>('#figure-dialog');
  const canvas = document.querySelector<HTMLElement>('#figure-canvas');
  const image = document.querySelector<HTMLImageElement>('#expanded-figure');
  if (!dialog || !canvas || !image) return;

  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const smaller = get<HTMLButtonElement>('figure-zoom-out');
  const larger = get<HTMLButtonElement>('figure-zoom-in');
  const output = get<HTMLOutputElement>('figure-zoom-level');

  let index = 0;
  let fitWidth = 0;
  let opener: HTMLElement | undefined;
  let drag: { id: number; x: number; y: number; left: number; top: number } | undefined;

  function applyZoom(center = true) {
    if (!fitWidth) return;
    const before = image!.getBoundingClientRect();
    const viewport = canvas!.getBoundingClientRect();
    const centerX = viewport.left + canvas!.clientLeft + canvas!.clientWidth / 2;
    const centerY = viewport.top + canvas!.clientTop + canvas!.clientHeight / 2;
    const fractionX = before.width ? Math.max(0, Math.min(1, (centerX - before.left) / before.width)) : 0.5;
    const fractionY = before.height ? Math.max(0, Math.min(1, (centerY - before.top) / before.height)) : 0.5;
    image!.style.width = `${fitWidth * ZOOM_LEVELS[index]}px`;
    const after = image!.getBoundingClientRect();
    canvas!.scrollLeft = center ? canvas!.scrollLeft + after.left + fractionX * after.width - centerX : 0;
    canvas!.scrollTop = center ? canvas!.scrollTop + after.top + fractionY * after.height - centerY : 0;
    canvas!.dataset.zoomed = String(index > 0);
    output.value = `${Math.round(ZOOM_LEVELS[index] * 100)}%`;
    smaller.disabled = index === 0;
    larger.disabled = index === ZOOM_LEVELS.length - 1;
  }

  function fit() {
    if (!dialog!.open || !image!.naturalWidth || !image!.naturalHeight) return;
    fitWidth = Math.min(
      image!.naturalWidth,
      canvas!.clientWidth - 32,
      ((canvas!.clientHeight - 32) * image!.naturalWidth) / image!.naturalHeight,
    );
    applyZoom(false);
  }

  image.addEventListener('load', fit);
  smaller.addEventListener('click', () => {
    index = Math.max(0, index - 1);
    applyZoom();
  });
  larger.addEventListener('click', () => {
    index = Math.min(ZOOM_LEVELS.length - 1, index + 1);
    applyZoom();
  });
  get('figure-fit').addEventListener('click', () => {
    index = 0;
    fit();
  });
  get('close-figure').addEventListener('click', () => dialog.close());

  dialog.addEventListener('close', () => {
    drag = undefined;
    delete canvas.dataset.dragging;
    opener?.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', (event) => {
    // 点击对话框空白处关闭，点内容不关
    if (event.target === dialog) dialog.close();
  });

  activeResizeObserver = new ResizeObserver(() => {
    if (dialog.open) fit();
  });
  activeResizeObserver.observe(canvas);

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || index === 0) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = 'true';
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    canvas.scrollLeft = drag.left + drag.x - event.clientX;
    canvas.scrollTop = drag.top + drag.y - event.clientY;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, () => {
      drag = undefined;
      delete canvas.dataset.dragging;
    });
  }

  function open(source: HTMLImageElement, button: HTMLElement, caption: string) {
    opener = button;
    index = 0;
    fitWidth = 0;
    image!.style.width = '';
    image!.src = source.currentSrc || source.src;
    image!.alt = source.alt;
    get<HTMLAnchorElement>('figure-original').href = image!.src;
    get('figure-caption').textContent = caption;
    dialog!.showModal();
    fit();
  }

  // 无 JavaScript 时这层 <a> 直接指向原图；脚本就绪后接管点击改用对话框。
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement | null)?.closest?.('a[data-figure-open]');
    if (!link) return;
    const source = link.querySelector('img');
    if (!source) return;
    event.preventDefault();
    const figure = link.closest('figure');
    const caption = figure?.querySelector('.figure-caption')?.textContent?.trim() ?? source.alt;
    open(source as HTMLImageElement, link as HTMLElement, caption);
  }, { signal });
}
