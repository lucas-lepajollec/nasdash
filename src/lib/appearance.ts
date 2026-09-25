/** Soft edges from Appearance: surfaces fade over `px` instead of ending on a line. */
export function applySoftEdges(px: number) {
  if (px > 0) {
    document.body.style.setProperty('--nd-soft-edge', `${px}px`);
    document.body.setAttribute('data-soft-edges', 'on');
  } else {
    document.body.style.removeProperty('--nd-soft-edge');
    document.body.removeAttribute('data-soft-edges');
  }
}
