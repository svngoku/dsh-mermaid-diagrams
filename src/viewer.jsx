/**
 * Full-screen diagram viewer: dark backdrop, white panel, zoom pill, and an
 * optional live code editor. Opened from a card's expand button.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { highlightLines } from './highlight.js';

import { clampZoom, fitZoom, MAX_ZOOM, MIN_ZOOM, naturalSize, ZOOM_STEP } from './viewer-math.js';

const iconProps = { viewBox: '0 0 20 20', 'aria-hidden': true, focusable: 'false', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ICON_CLOSE = (
  <svg {...iconProps}>
    <path d="M5 5l10 10M15 5L5 15" />
  </svg>
);
const ICON_DOWNLOAD = (
  <svg {...iconProps}>
    <path d="M10 3.5v9" />
    <path d="M6.5 9.5 10 13l3.5-3.5" />
    <path d="M4 16h12" />
  </svg>
);
const ICON_MINUS = (
  <svg {...iconProps}>
    <path d="M5 10h10" />
  </svg>
);
const ICON_PLUS = (
  <svg {...iconProps}>
    <path d="M5 10h10M10 5v10" />
  </svg>
);

export const VIEWER_CSS = `
.mmd-lb { position: fixed; inset: 0; z-index: 10000; background: rgba(18, 18, 18, 0.9); display: flex; flex-direction: column; font: inherit; animation: mmd-lb-in .14s ease-out; }
@keyframes mmd-lb-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mmd-lb { animation: none; } }
.mmd-lb-top { position: absolute; top: 14px; right: 18px; z-index: 2; display: flex; align-items: center; gap: 10px; }
.mmd-lb-pill { appearance: none; border: 0; cursor: pointer; background: #fff; color: #161616; font: inherit; font-size: 14px; font-weight: 500; line-height: 1; height: 44px; padding: 0 22px; border-radius: 999px; box-shadow: 0 2px 10px rgba(0,0,0,.28); }
.mmd-lb-round { appearance: none; border: 0; cursor: pointer; background: #fff; color: #161616; width: 44px; height: 44px; padding: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,.28); }
.mmd-lb-pill:hover, .mmd-lb-round:hover { background: #f0f0f0; }
.mmd-lb-pill[aria-pressed="true"] { background: #e4e4e4; }
.mmd-lb-pill:focus-visible, .mmd-lb-round:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }
.mmd-lb-round svg { width: 20px; height: 20px; display: block; }
.mmd-lb-panel { position: absolute; left: 18px; right: 18px; top: 66px; bottom: 96px; border-radius: 26px; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr); background: #fff; color: #161616; box-shadow: 0 10px 40px rgba(0,0,0,.4); outline: none; }
.mmd-lb-panel[data-scheme="dark"] { background: #1b1b1b; color: #eee; }
.mmd-lb-panel[data-editing="true"] { grid-template-columns: minmax(260px, 38%) minmax(0, 1fr); }
.mmd-lb-editor { display: flex; flex-direction: column; min-width: 0; border-right: 1px solid rgba(128,128,128,.25); background: rgba(128,128,128,.06); }
.mmd-lb-codebox { position: relative; flex: 1; min-height: 0; }
.mmd-lb-code, .mmd-lb-paint { position: absolute; inset: 0; margin: 0; border: 0; box-sizing: border-box; padding: 22px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.6; tab-size: 2; white-space: pre-wrap; overflow-wrap: break-word; overflow: auto; }
.mmd-lb-paint { overflow: hidden; pointer-events: none; color: inherit; }
.mmd-lb-code { resize: none; outline: none; background: transparent; color: transparent; caret-color: currentColor; }
.mmd-lb-code::selection { background: rgba(59, 108, 246, .3); }
.mmd-lb-pane[data-scheme="dark"] .mmd-tok-keyword { color: #b9b9b9; font-weight: 600; }
.mmd-lb-pane[data-scheme="dark"] .mmd-tok-name { color: #e6e6e6; }
.mmd-lb-pane[data-scheme="dark"] .mmd-tok-label { color: #8fd0a0; }
.mmd-lb-pane[data-scheme="dark"] .mmd-tok-operator { color: #b0b0b0; }
.mmd-lb-pane[data-scheme="dark"] .mmd-tok-comment { color: #7c7c7c; }
.mmd-lb-pane[data-scheme="dark"] .mmd-tok-type { color: #c9c9c9; }
.mmd-lb-error { padding: 10px 22px 14px; font-size: 12px; line-height: 1.5; color: #c93c3c; overflow-wrap: anywhere; border-top: 1px solid rgba(128,128,128,.25); }
.mmd-lb-scroll { overflow: auto; min-width: 0; min-height: 0; display: flex; cursor: grab; touch-action: none; }
.mmd-lb-scroll[data-dragging="true"] { cursor: grabbing; user-select: none; }
.mmd-lb-stage { margin: auto; padding: 24px; flex: none; }
.mmd-lb-stage svg { display: block; width: var(--mmd-w); max-width: none !important; height: auto; }
.mmd-lb-zoom { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 2; display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 999px; background: #f6f6f6; box-shadow: 0 2px 14px rgba(0,0,0,.32); }
.mmd-lb-step { appearance: none; border: 0; cursor: pointer; width: 44px; height: 44px; border-radius: 50%; background: #e2e2e2; color: #161616; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
.mmd-lb-step:hover:not(:disabled) { background: #d4d4d4; }
.mmd-lb-step:disabled { opacity: .4; cursor: default; }
.mmd-lb-step:focus-visible, .mmd-lb-percent:focus-visible { outline: 2px solid #3b6cf6; outline-offset: 2px; }
.mmd-lb-step svg { width: 20px; height: 20px; display: block; }
.mmd-lb-percent { appearance: none; border: 0; background: transparent; cursor: pointer; min-width: 84px; height: 44px; border-radius: 999px; font: inherit; font-size: 17px; color: #161616; font-variant-numeric: tabular-nums; }
.mmd-lb-percent:hover { background: #ececec; }
.mmd-lb-pane[data-scheme="light"] .mmd-tok-keyword { color: #0b6bcb; font-weight: 600; }
.mmd-lb-pane[data-scheme="light"] .mmd-tok-name { color: #161616; }
.mmd-lb-pane[data-scheme="light"] .mmd-tok-label { color: #1a7f37; }
.mmd-lb-pane[data-scheme="light"] .mmd-tok-operator { color: #6b6b6b; }
.mmd-lb-pane[data-scheme="light"] .mmd-tok-comment { color: #8a8a8a; }
.mmd-lb-pane[data-scheme="light"] .mmd-tok-type { color: #8250df; }
@media (max-width: 720px) { .mmd-lb-panel[data-editing="true"] { grid-template-columns: minmax(0, 1fr); grid-template-rows: 40% 60%; } .mmd-lb-editor { border-right: 0; border-bottom: 1px solid rgba(128,128,128,.25); } }
`;

/**
 * Full-screen viewer for one diagram.
 * @param {object} props - Viewer input.
 * @param {string} props.svg - Rendered SVG of the card's source.
 * @param {string} props.source - Mermaid source.
 * @param {'light' | 'dark'} props.scheme - Active color scheme.
 * @param {(key: string) => string} props.t - Localized copy.
 * @param {(code: string, scheme: 'light' | 'dark') => Promise<string>} props.render - Render a source to SVG.
 * @param {(svg: string) => void} props.onDownload - Save the shown SVG.
 * @param {() => void} props.onClose - Close the viewer.
 * @returns {import('react').ReactPortal} The viewer, portaled to the document body.
 */
/**
 * Highlighted code editor: a transparent textarea over a painted copy of the
 * same text, so typing, selection and scrolling stay native while the text is
 * colored by the Mermaid highlighter.
 * @param {{ value: string, onChange: (value: string) => void, label: string }} props - Editor input.
 * @returns {import('react').ReactElement} Editor.
 */
function CodeEditor({ value, onChange, label }) {
  const paintRef = React.useRef(null);
  const codeRef = React.useRef(null);
  const lines = React.useMemo(() => highlightLines(value), [value]);

  // Keep the painted copy aligned with the textarea's scroll position.
  const sync = React.useCallback(() => {
    const code = codeRef.current;
    const paint = paintRef.current;
    if (code === null || paint === null) return;
    paint.scrollTop = code.scrollTop;
    paint.scrollLeft = code.scrollLeft;
  }, []);

  return (
    <div className="mmd-lb-codebox">
      <div ref={paintRef} className="mmd-lb-paint" aria-hidden="true">
        {lines.map((html, index) => (
          // eslint-disable-next-line react/no-danger -- the highlighter escapes every token.
          <div key={index} dangerouslySetInnerHTML={{ __html: html === '' ? ' ' : html }} />
        ))}
      </div>
      <textarea
        ref={codeRef}
        className="mmd-lb-code"
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onScroll={sync}
      />
    </div>
  );
}

export function Viewer({ svg, source, scheme, t, render, onDownload, onClose }) {
  const [shown, setShown] = React.useState(svg);
  const [zoom, setZoom] = React.useState(1);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(source);
  const [error, setError] = React.useState('');
  const [dragging, setDragging] = React.useState(false);
  const panelRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const drag = React.useRef(null);
  const size = React.useMemo(() => naturalSize(shown), [shown]);

  const fit = React.useCallback(() => {
    const box = scrollRef.current;
    if (box === null) return;
    setZoom(fitZoom(size, box.clientWidth, box.clientHeight));
  }, [size]);

  // Fit on open and whenever the diagram or the editor pane changes the viewport.
  React.useLayoutEffect(() => {
    fit();
  }, [fit, editing]);

  // Focus the dialog, and give focus back to the opener on close.
  React.useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const changeZoom = React.useCallback((delta) => setZoom((value) => clampZoom(value + delta)), []);

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.target instanceof HTMLTextAreaElement) return;
      if (event.key === '+' || event.key === '=') changeZoom(ZOOM_STEP);
      else if (event.key === '-') changeZoom(-ZOOM_STEP);
      else if (event.key === '0') fit();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, changeZoom, fit]);

  // Live preview of an edited source; a failing draft keeps the last good diagram.
  React.useEffect(() => {
    if (!editing) return undefined;
    if (draft.trim() === source.trim()) {
      setShown(svg);
      setError('');
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(() => {
      render(draft, scheme).then(
        (next) => {
          if (!alive) return;
          setShown(next);
          setError('');
        },
        (failure) => {
          if (alive) setError(String(failure?.message ?? failure).split('\n')[0]);
        },
      );
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [draft, editing, render, scheme, source, svg]);

  const onWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  const onPointerDown = (event) => {
    const box = scrollRef.current;
    if (box === null || event.button !== 0) return;
    if (box.scrollWidth <= box.clientWidth && box.scrollHeight <= box.clientHeight) return;
    drag.current = { x: event.clientX, y: event.clientY, left: box.scrollLeft, top: box.scrollTop };
    box.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event) => {
    const start = drag.current;
    const box = scrollRef.current;
    if (start === null || box === null) return;
    box.scrollLeft = start.left - (event.clientX - start.x);
    box.scrollTop = start.top - (event.clientY - start.y);
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const percent = `${String(Math.round(zoom * 100))}%`;
  const width = size.width > 0 ? `${String(size.width * zoom)}px` : 'auto';

  return createPortal(
    <div
      className="mmd-lb"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mmd-lb-top">
        <button type="button" className="mmd-lb-pill" aria-pressed={editing} onClick={() => setEditing((open) => !open)}>
          {editing ? t('viewDiagram') : t('editCode')}
        </button>
        <button type="button" className="mmd-lb-round" aria-label={t('download')} title={t('download')} onClick={() => onDownload(shown)}>
          {ICON_DOWNLOAD}
        </button>
        <button type="button" className="mmd-lb-round" aria-label={t('close')} title={t('close')} onClick={onClose}>
          {ICON_CLOSE}
        </button>
      </div>

      <div
        ref={panelRef}
        className="mmd-lb-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('name')}
        tabIndex={-1}
        data-scheme={scheme}
        data-editing={editing}
      >
        {editing ? (
          <div className="mmd-lb-editor mmd-lb-pane" data-scheme={scheme}>
            <CodeEditor value={draft} onChange={setDraft} label={t('editCode')} />
            {error === '' ? null : <div className="mmd-lb-error">{error}</div>}
          </div>
        ) : null}
        <div
          ref={scrollRef}
          className="mmd-lb-scroll"
          data-dragging={dragging}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mmd-lb-stage" style={{ '--mmd-w': width }} dangerouslySetInnerHTML={{ __html: shown }} />
        </div>
      </div>

      <div className="mmd-lb-zoom" role="group" aria-label={t('zoom')}>
        <button type="button" className="mmd-lb-step" aria-label={t('zoomOut')} title={t('zoomOut')} disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(-ZOOM_STEP)}>
          {ICON_MINUS}
        </button>
        <button type="button" className="mmd-lb-percent" aria-label={t('zoomFit')} title={t('zoomFit')} onClick={fit}>
          {percent}
        </button>
        <button type="button" className="mmd-lb-step" aria-label={t('zoomIn')} title={t('zoomIn')} disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(ZOOM_STEP)}>
          {ICON_PLUS}
        </button>
      </div>
    </div>,
    document.body,
  );
}
