/** Top-layer container for portaled dropdowns (escapes backdrop-filter stacking traps). */
export function getHqOverlayRoot(doc: Document = document): HTMLElement {
  let root = doc.getElementById('hq-overlay-root');
  if (!root) {
    root = doc.createElement('div');
    root.id = 'hq-overlay-root';
    doc.body.appendChild(root);
  }
  return root;
}

export function portalToOverlay(node: HTMLElement, doc: Document = document): void {
  const root = getHqOverlayRoot(doc);
  if (node.parentElement !== root) {
    root.appendChild(node);
  }
}

/** Remove every portaled node — safety net on route changes. */
export function clearHqOverlay(doc: Document = document): void {
  const root = doc.getElementById('hq-overlay-root');
  if (root) {
    root.replaceChildren();
  }
}

export function removeFromOverlay(node: HTMLElement | null | undefined): void {
  if (node?.parentElement?.id === 'hq-overlay-root') {
    node.remove();
  }
}

export interface AnchoredPopoverOptions {
  minWidth?: number;
  gap?: number;
  maxHeight?: number;
  align?: 'start' | 'end';
}

export function syncAnchoredPopover(
  anchor: HTMLElement,
  panel: HTMLElement,
  options: AnchoredPopoverOptions = {},
): void {
  const gap = options.gap ?? 6;
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxPanelWidth = Math.max(160, viewportWidth - 16);
  const minWidth = Math.min(options.minWidth ?? rect.width, maxPanelWidth);
  const width = Math.min(Math.max(minWidth, rect.width), maxPanelWidth);
  const maxHeight = options.maxHeight ?? Math.min(240, viewportHeight * 0.4);

  panel.style.position = 'fixed';
  panel.style.minWidth = `${minWidth}px`;
  panel.style.width = `${width}px`;
  panel.style.maxHeight = `${Math.min(maxHeight, viewportHeight - 16)}px`;
  panel.style.overflowY = 'auto';

  // Measure off-screen so hidden menus still get an accurate height for placement.
  panel.style.visibility = 'hidden';
  panel.style.left = '-9999px';
  panel.style.top = '0';
  const panelHeight = panel.offsetHeight || panel.scrollHeight || maxHeight;

  const spaceBelow = viewportHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;

  let top = rect.bottom + gap;
  if (spaceBelow < panelHeight && spaceAbove > spaceBelow) {
    top = rect.top - panelHeight - gap;
  }
  top = Math.min(Math.max(gap, top), Math.max(gap, viewportHeight - panelHeight - gap));
  panel.style.top = `${top}px`;

  const align = options.align ?? 'start';
  let left = align === 'end' ? rect.right - width : rect.left;
  if (left + width > viewportWidth - 8) {
    left = viewportWidth - width - 8;
  }
  if (left < 8) left = 8;
  panel.style.left = `${left}px`;

  panel.classList.add('hq-positioned');
  panel.style.visibility = '';
}

/** Remove stray portaled popovers that outlived their host component state. */
export function purgeOrphanedOverlayPopovers(
  selectors = '.hq-select-menu, .hq-date-range-popover',
): void {
  const root = document.getElementById('hq-overlay-root');
  if (!root) return;
  root.querySelectorAll(selectors).forEach((node) => node.remove());
}

export function resetAnchoredPopover(panel: HTMLElement): void {
  panel.classList.remove('hq-positioned');
  panel.style.position = '';
  panel.style.top = '';
  panel.style.left = '';
  panel.style.width = '';
  panel.style.minWidth = '';
  panel.style.maxHeight = '';
  panel.style.overflowY = '';
  panel.style.visibility = '';
}
