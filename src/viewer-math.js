/** Pure zoom and sizing math for the diagram viewer. */

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.1;
const FIT_CEILING = 1.25;

/**
 * Natural width and height of a rendered Mermaid SVG, read from its viewBox.
 * @param {string} svg - Serialized SVG.
 * @returns {{ width: number, height: number }} Size in CSS pixels; 0 when unknown.
 */
export function naturalSize(svg) {
  const match = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  if (match === null) return { width: 0, height: 0 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Clamp and round a zoom factor to a 5% step.
 * @param {number} value - Raw zoom factor.
 * @returns {number} Valid zoom factor.
 */
export function clampZoom(value) {
  const stepped = Math.round(value * 20) / 20;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, stepped));
}

/**
 * Zoom that fits a diagram inside a viewport, never enlarging past the ceiling.
 * @param {{ width: number, height: number }} size - Diagram size.
 * @param {number} viewWidth - Available width.
 * @param {number} viewHeight - Available height.
 * @returns {number} Fit zoom factor.
 */
export function fitZoom(size, viewWidth, viewHeight) {
  if (size.width <= 0 || size.height <= 0 || viewWidth <= 0 || viewHeight <= 0) return 1;
  const pad = 48;
  const fit = Math.min((viewWidth - pad) / size.width, (viewHeight - pad) / size.height, FIT_CEILING);
  // Round down so the fitted diagram never overflows the viewport.
  return clampZoom(Math.floor(fit * 20) / 20);
}

