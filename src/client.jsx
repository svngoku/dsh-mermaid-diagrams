/**
 * Browser half: replaces every Mermaid code block in Chat with the rendered
 * diagram, in place.
 *
 * Chat's shared Markdown renderer exposes no hook for a code fence's language,
 * so `enhancer.js` watches the page for rendered code blocks, mounts a diagram
 * card after each valid Mermaid block, and hides the original block. Disposing
 * the plugin restores every block.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import en from './en.js';
import fr from './fr.js';
import { createEnhancer } from './enhancer.js';
import { mermaidType } from './mermaid-source.js';
import { themeCssFor, themeVariablesFor } from './theme.js';
import { Viewer, VIEWER_CSS } from './viewer.jsx';

const NS = 'mermaid';

/** Live color-scheme source owned by `apply` and read by every card. */
let schemeSource = null;

const EMPTY_SUBSCRIBE = () => () => {};

//#region Mermaid runtime

/** Rendered SVGs keyed by color scheme and source, newest last. */
const SVG_CACHE = new Map();
const SVG_CACHE_LIMIT = 40;

let mermaidPromise = null;
let mermaidReadyFor = null;
let renderSeq = 0;

/**
 * Load the bundled Mermaid runtime once, keeping its module body out of first
 * paint.
 * @returns {Promise<any>} Mermaid API.
 */
function loadMermaid() {
  if (mermaidPromise === null) {
    mermaidPromise = Promise.resolve()
      .then(() => import('mermaid'))
      .then((module) => module.default ?? module);
  }
  return mermaidPromise;
}

/**
 * Resolve the host text font so diagram labels match ordinary Chat copy.
 * @returns {string} CSS font family list, or an empty string when unavailable.
 */
function hostFontFamily() {
  try {
    return globalThis.getComputedStyle?.(document.body)?.fontFamily ?? '';
  } catch {
    return '';
  }
}

/**
 * Render one Mermaid source to an SVG document string.
 * @param {string} code - Mermaid source.
 * @param {'light' | 'dark'} scheme - Active host color scheme.
 * @returns {Promise<string>} Serialized SVG.
 */
async function renderDiagram(code, scheme) {
  const mermaid = await loadMermaid();
  if (mermaidReadyFor !== scheme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      themeVariables: themeVariablesFor(scheme, hostFontFamily()),
      themeCSS: themeCssFor(scheme),
      flowchart: { curve: 'step', htmlLabels: true, padding: 14, nodeSpacing: 40, rankSpacing: 48, useMaxWidth: true },
      sequence: { useMaxWidth: true, mirrorActors: true, actorMargin: 48, boxMargin: 6, messageMargin: 34, noteMargin: 8, width: 150, height: 48, actorFontSize: 13, messageFontSize: 12, noteFontSize: 12 },
      state: { useMaxWidth: true },
      er: { useMaxWidth: true, layoutDirection: 'TB', entityPadding: 12 },
      maxTextSize: 200_000,
      maxEdges: 1_000,
    });
    mermaidReadyFor = scheme;
  }
  renderSeq += 1;
  const { svg } = await mermaid.render(`mermaid-diagrams-${String(renderSeq)}`, code);
  return svg;
}

/**
 * Read a rendered SVG from the cache and mark it most recently used.
 * @param {string} key - Cache key.
 * @returns {string | undefined} Cached SVG.
 */
function readCached(key) {
  const value = SVG_CACHE.get(key);
  if (value === undefined) return undefined;
  SVG_CACHE.delete(key);
  SVG_CACHE.set(key, value);
  return value;
}

/**
 * Store one rendered SVG, evicting the oldest entry past the limit.
 * @param {string} key - Cache key.
 * @param {string} svg - Serialized SVG.
 * @returns {void}
 */
function writeCached(key, svg) {
  SVG_CACHE.set(key, svg);
  while (SVG_CACHE.size > SVG_CACHE_LIMIT) {
    const oldest = SVG_CACHE.keys().next();
    if (oldest.done === true) break;
    SVG_CACHE.delete(oldest.value);
  }
}

//#endregion

//#region Presentation

const CSS = `
[data-mmd-hidden] { display: none !important; }
.mmd-host { margin-block: 12px; width: 100%; min-width: 0; }
.mmd-card { position: relative; background: transparent; }
.mmd-tools { position: absolute; top: 0; right: 0; z-index: 1; display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s ease; }
.mmd-card:hover .mmd-tools, .mmd-card:focus-within .mmd-tools { opacity: 1; }
.mmd-btn { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary); padding: 5px; width: 26px; height: 26px; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.mmd-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.mmd-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.mmd-btn[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.mmd-btn svg { width: 15px; height: 15px; display: block; }
.mmd-canvas { padding: 4px 28px 4px 0; overflow: auto; max-height: 640px; }
.mmd-canvas svg { display: block; max-width: 100%; height: auto; margin: 0; }
.mmd-source { margin: 8px 0 0; padding: 12px; border-radius: 10px; background: var(--dsw-alias-bg-layer-1); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 260px; overflow: auto; }
.mmd-state { padding: 8px 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.mmd-state[data-error="true"] { color: var(--dsw-alias-state-error-primary); }
.mmd-detail { display: block; margin-top: 2px; font-size: 11px; opacity: .85; overflow-wrap: anywhere; }
`+VIEWER_CSS;

const iconProps = { viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ICON_COPY = (
  <svg {...iconProps}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="2" />
    <path d="M10.5 5.5v-1a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1" />
  </svg>
);
const ICON_CHECK = (
  <svg {...iconProps}>
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
  </svg>
);
const ICON_CODE = (
  <svg {...iconProps}>
    <path d="M5.5 4.5 2 8l3.5 3.5" />
    <path d="M10.5 4.5 14 8l-3.5 3.5" />
  </svg>
);
const ICON_DOWNLOAD = (
  <svg {...iconProps}>
    <path d="M8 2.5v8" />
    <path d="M4.5 7.5 8 11l3.5-3.5" />
    <path d="M3 13.5h10" />
  </svg>
);
const ICON_EXPAND = (
  <svg {...iconProps}>
    <path d="M9.5 2.5h4v4" />
    <path d="M6.5 13.5h-4v-4" />
    <path d="M13.5 2.5 9 7" />
    <path d="M2.5 13.5 7 9" />
  </svg>
);
/**
 * Subscribe to one observable snapshot source.
 * @param {{ getSnapshot: () => any, subscribe: (fn: () => void) => () => void } | undefined} source - Source.
 * @param {any} fallback - Value reported when the source is absent.
 * @returns {any} Current value.
 */
function useSnapshot(source, fallback) {
  const subscribe = source?.subscribe ?? EMPTY_SUBSCRIBE;
  const getSnapshot = source?.getSnapshot ?? (() => fallback);
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Copy text to the clipboard, tolerating a refused permission.
 * @param {string} text - Text to copy.
 * @returns {Promise<boolean>} Whether the copy succeeded.
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Offer one SVG document as a file download through a transient anchor.
 * @param {string} svg - Serialized SVG.
 * @param {string} name - File name without extension.
 * @returns {void}
 */
function downloadSvg(svg, name) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name}.svg`;
  anchor.rel = 'noopener';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Render one Mermaid diagram with its toolbar.
 * @param {{ source: string, scheme: 'light' | 'dark', t: (key: string) => string, onError: () => void }} props - Diagram input.
 * @returns {import('react').ReactElement} Card.
 */
function DiagramCard({ source, scheme, t, onError }) {
  const type = mermaidType(source);
  const [view, setView] = React.useState({ status: 'loading' });
  const [showSource, setShowSource] = React.useState(false);
  const [viewing, setViewing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const cacheKey = `${scheme}\u0000${source}`;

  React.useEffect(() => {
    const cached = readCached(cacheKey);
    if (cached !== undefined) {
      setView({ status: 'ready', svg: cached });
      return undefined;
    }
    let alive = true;
    setView({ status: 'loading' });
    renderDiagram(source, scheme).then(
      (svg) => {
        writeCached(cacheKey, svg);
        if (alive) setView({ status: 'ready', svg });
      },
      (error) => {
        if (!alive) return;
        setView({ status: 'error', detail: String(error?.message ?? error).split('\n')[0] });
      },
    );
    return () => {
      alive = false;
    };
  }, [cacheKey, source, scheme]);

  const failedRender = view.status === 'error';
  React.useEffect(() => {
    if (failedRender) onError?.();
  }, [failedRender, onError]);

  React.useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const label = type === '' ? t('diagram') : `${t('name')} · ${t(`type.${type}`)}`;

  return (
    <div className="mmd-card" role="group" aria-label={label}>
      <div className="mmd-tools">
        <button
          type="button"
          className="mmd-btn"
          aria-pressed={showSource}
          aria-label={showSource ? t('hideSource') : t('showSource')}
          title={showSource ? t('hideSource') : t('showSource')}
          onClick={() => setShowSource((open) => !open)}
        >
          {ICON_CODE}
        </button>
        {view.status === 'ready' ? (
          <button
            type="button"
            className="mmd-btn"
            aria-label={t('download')}
            title={t('download')}
            onClick={() => downloadSvg(view.svg, `diagram-${type === '' ? 'mermaid' : type}`)}
          >
            {ICON_DOWNLOAD}
          </button>
        ) : null}
        {view.status === 'ready' ? (
          <button
            type="button"
            className="mmd-btn"
            aria-haspopup="dialog"
            aria-label={t('expand')}
            title={t('expand')}
            onClick={() => setViewing(true)}
          >
            {ICON_EXPAND}
          </button>
        ) : null}
        <button
          type="button"
          className="mmd-btn"
          aria-label={copied ? t('copied') : t('copy')}
          title={copied ? t('copied') : t('copy')}
          onClick={async () => {
            if (await copyText(source)) setCopied(true);
          }}
        >
          {copied ? ICON_CHECK : ICON_COPY}
        </button>
      </div>
      {view.status === 'loading' ? <div className="mmd-state">{t('loading')}</div> : null}
      {view.status === 'error' ? (
        <div className="mmd-state" data-error="true">
          {t('error')}
          <span className="mmd-detail">{view.detail}</span>
        </div>
      ) : null}
      {view.status === 'ready' ? (
        <div className="mmd-canvas" dangerouslySetInnerHTML={{ __html: view.svg }} />
      ) : null}
      {showSource ? <pre className="mmd-source">{source}</pre> : null}
      {viewing && view.status === 'ready' ? (
        <Viewer
          svg={view.svg}
          source={source}
          scheme={scheme}
          t={t}
          render={renderDiagram}
          onDownload={(svg) => downloadSvg(svg, `diagram-${type === '' ? 'mermaid' : type}`)}
          onClose={() => setViewing(false)}
        />
      ) : null}
    </div>
  );
}

/** Report one diagnostic per distinct problem, never once per render. */
const WARNED = new Set();

/**
 * Emit a throttled console warning so a silent failure is explainable.
 * @param {string} message - What failed.
 * @param {unknown} [error] - Optional cause.
 * @returns {void}
 */
function warnOnce(message, error) {
  if (WARNED.has(message)) return;
  WARNED.add(message);
  console.warn(`[mermaid-diagrams] ${message}`, ...(error === undefined ? [] : [error]));
}

/**
 * Contain a rendering failure so one bad diagram never blanks a Chat row.
 */
class CardBoundary extends React.Component {
  /**
   * @param {any} props - Children and failure callback.
   */
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  /**
   * @returns {{ failed: true }} Recovery state.
   */
  static getDerivedStateFromError() {
    return { failed: true };
  }

  /**
   * @param {Error} error - Rendering failure.
   * @returns {void}
   */
  componentDidCatch(error) {
    warnOnce('a diagram card failed to render', error);
    this.props.onError?.();
  }

  /**
   * @returns {any} Children or nothing.
   */
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

//#endregion

export const inject = ['locale', 'theme'];

/**
 * Whether a code block holds complete, valid Mermaid.
 * @param {string} source - Code read from a block.
 * @returns {Promise<boolean>} Validity; false for anything unparsable or still streaming.
 */
async function isValidMermaid(source) {
  try {
    const mermaid = await loadMermaid();
    const result = await mermaid.parse(source, { suppressErrors: true });
    return result !== false;
  } catch {
    return false;
  }
}

/**
 * Client plugin body: register dictionaries and styles, follow the theme, and
 * start replacing Mermaid code blocks in the page.
 * @param {any} ctx - Client root context.
 * @returns {void}
 */
export function apply(ctx) {
  let scheme = ctx.theme.getTheme().active.colorScheme;
  const listeners = new Set();
  schemeSource = {
    getSnapshot: () => scheme,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  ctx.effect(() => () => {
    schemeSource = null;
    listeners.clear();
  }, 'mermaid-diagrams: color-scheme source');

  ctx.effect(() => ctx.locale.register(NS, 'en', en), 'mermaid-diagrams: en dictionary');
  ctx.effect(() => ctx.locale.register(NS, 'fr', fr), 'mermaid-diagrams: fr dictionary');
  const t = ctx.locale.bind(NS);

  ctx.effect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-mermaid-diagrams', '');
    style.textContent = CSS;
    document.head.append(style);
    return () => style.remove();
  }, 'mermaid-diagrams: styles');

  const enhancer = createEnhancer({
    container: document.body,
    validate: isValidMermaid,
    mount(host, initial, hooks) {
      const root = createRoot(host);
      let source = initial;
      const draw = () => {
        root.render(
          <CardBoundary onError={hooks.onError}>
            <ThemedCard source={source} t={t} onError={hooks.onError} />
          </CardBoundary>,
        );
      };
      draw();
      return {
        update(next) {
          source = next;
          draw();
        },
        refresh: draw,
        unmount() {
          // Defer so unmounting never happens during a React render pass.
          queueMicrotask(() => root.unmount());
        },
      };
    },
  });
  ctx.effect(() => () => enhancer.dispose(), 'mermaid-diagrams: code block enhancer');

  ctx.on('theme/change', (snapshot) => {
    if (snapshot.active.colorScheme === scheme) return;
    scheme = snapshot.active.colorScheme;
    for (const listener of listeners) listener();
  });
  ctx.on('locale/change', () => enhancer.refresh());
  console.info('[mermaid-diagrams] ready');
}

/**
 * Card bound to the live color scheme.
 * @param {{ source: string, t: (key: string) => string, onError: () => void }} props - Card input.
 * @returns {import('react').ReactElement} Diagram card.
 */
function ThemedCard({ source, t, onError }) {
  const scheme = useSnapshot(schemeSource, 'light') === 'dark' ? 'dark' : 'light';
  return <DiagramCard source={source} scheme={scheme} t={t} onError={onError} />;
}
