/**
 * Diagram rendering through Pele, a small synchronous Mermaid renderer.
 *
 * Kept free of React and the DOM so it can be exercised directly in Node.
 * Colors come from `--pele-*` CSS variables (see `theme.js`), so a theme
 * switch restyles an existing SVG without rendering it again.
 */
import { detectType, parse, render } from 'pele';

/** Base font size in px; matches Chat's compact diagram labels. */
export const FONT_SIZE = 13;

/** Pele configuration: smooth curved edges. */
export const RENDER_CONFIG = Object.freeze({ flowchart: { curve: 'basis' } });

/**
 * Render one diagram source to an SVG document string.
 * @param {string} source - Mermaid source.
 * @param {string} [fontFamily] - Host font family list, so labels are measured in the font they are drawn in.
 * @returns {{ svg: string, width: number, height: number, type: string }} Rendered diagram.
 * @throws {Error} A `PeleError` when the source is invalid, unsupported or over a limit.
 */
export function renderDiagram(source, fontFamily = '') {
  const result = render(source, {
    ...(fontFamily === '' ? {} : { fontFamily }),
    fontSize: FONT_SIZE,
    links: false,
    images: false,
    config: RENDER_CONFIG,
  });
  return { svg: result.svg, width: result.width, height: result.height, type: result.type };
}

/**
 * Whether a source is complete, valid, supported diagram text. A half-streamed
 * block fails to parse, so it stays plain code until it is whole.
 * @param {string} source - Code read from a block.
 * @returns {boolean} True when it parses.
 */
export function isValidDiagram(source) {
  try {
    parse(source);
    return true;
  } catch {
    return false;
  }
}

/**
 * Diagram type of a source, for file names.
 * @param {string} source - Mermaid source.
 * @returns {string} Type key such as `flowchart`, or an empty string.
 */
export function diagramType(source) {
  try {
    return detectType(source) ?? '';
  } catch {
    return '';
  }
}
