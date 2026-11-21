/** Pin a scrollable element to its bottom (no-op until the ref is mounted). */
export function stickToBottom(el: HTMLElement | null): void {
  if (el) el.scrollTop = el.scrollHeight;
}
