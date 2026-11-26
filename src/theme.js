/**
 * Pele theme: the flat grayscale look of the reference diagrams, expressed as
 * `--pele-*` CSS variables. Variables are set on the card and on the viewer
 * panel, never inside the SVG, so switching light/dark needs no re-render.
 */

const LIGHT = `
  --pele-bg: #ffffff;
  --pele-fg: #111111;
  --pele-fg-on-light: #111111;
  --pele-fg-on-dark: #ffffff;
  --pele-muted: #6b6b6b;
  --pele-line: #8a8a8a;
  --pele-surface: #e8e8e8;
  --pele-surface-alt: #f6f6f6;
  --pele-border: #d6d6d6;
  --pele-accent: #6b6b6b;
  --pele-critical: #c8504f;
  --pele-error: #c93c3c;
  --pele-radius: 14px;
  --pele-series-1: #8a8a8a;
  --pele-series-2: #b0b0b0;
  --pele-series-3: #6b6b6b;
  --pele-series-4: #cfcfcf;
  --pele-series-5: #4d4d4d;
  --pele-series-6: #a0a0a0;
  --pele-series-7: #7d7d7d;
  --pele-series-8: #c0c0c0;
`;

const DARK = `
  --pele-bg: #1b1b1b;
  --pele-fg: #eeeeee;
  --pele-fg-on-light: #111111;
  --pele-fg-on-dark: #ffffff;
  --pele-muted: #a8a8a8;
  --pele-line: #7d7d7d;
  --pele-surface: #2f2f2f;
  --pele-surface-alt: #262626;
  --pele-border: #444444;
  --pele-accent: #a8a8a8;
  --pele-critical: #d96a68;
  --pele-error: #e07070;
  --pele-radius: 14px;
  --pele-series-1: #8a8a8a;
  --pele-series-2: #6b6b6b;
  --pele-series-3: #a8a8a8;
  --pele-series-4: #555555;
  --pele-series-5: #c0c0c0;
  --pele-series-6: #7d7d7d;
  --pele-series-7: #939393;
  --pele-series-8: #474747;
`;

/** Scopes that carry the diagram variables: the inline card and the viewer panel. */
const SCOPES = ['.mmd-card', '.mmd-lb-panel'];

export const THEME_CSS = `
${SCOPES.map((scope) => scope).join(', ')} {${LIGHT}}
${SCOPES.map((scope) => scope + '[data-scheme="dark"]').join(', ')} {${DARK}}
/* The viewer panel supplies its own surface, so the diagram draws on it directly. */
.mmd-lb-panel { --pele-bg: transparent; }
`;
