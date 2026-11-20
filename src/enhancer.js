/**
 * In-place Mermaid replacement.
 *
 * Chat renders Markdown through a shared component that offers no hook for a
 * code fence's language, so a Slot cannot swap one fence for a diagram. This
 * module therefore watches the page for rendered code blocks, and for every
 * block that holds valid Mermaid it inserts a host element right after the
 * block and hides the original. The original block stays in the document, so
 * Chat's own state, copy button and search remain intact, and disposing the
 * enhancer puts every block back.
 *
 * Rendering is delegated through `mount`, which keeps this module free of
 * React and Mermaid so it can be exercised with a plain fake DOM.
 */
import { mermaidType } from './mermaid-source.js';

/** Class of the shared Markdown code block card. */
export const BLOCK_SELECTOR = '.md-code-block';
/** Marker on a host element this module inserted. */
export const HOST_ATTR = 'data-mmd-host';
/** Marker on a code block this module hides. */
export const HIDDEN_ATTR = 'data-mmd-hidden';

const SETTLE_MS = 120;

/**
 * Read the code a rendered block holds.
 * @param {Element} block - Code block card.
 * @returns {string} Trimmed code, or an empty string.
 */
export function sourceOfBlock(block) {
  const pre = block.querySelector('[data-code-block-content] pre') ?? block.querySelector('pre');
  return (pre?.textContent ?? '').replace(/\n$/, '').trim();
}

/**
 * Whether a mutation happened inside one of this module's own hosts.
 * @param {MutationRecord} record - Observed mutation.
 * @returns {boolean} True when the mutation is self-inflicted.
 */
function isOwnMutation(record) {
  const target = record.target;
  const element = target.nodeType === 1 ? target : target.parentElement;
  return element?.closest?.(`[${HOST_ATTR}]`) != null;
}

/**
 * Start replacing Mermaid code blocks under a container.
 * @param {object} options - Enhancer wiring.
 * @param {ParentNode & Node} options.container - Subtree to watch.
 * @param {(source: string) => Promise<boolean>} options.validate - Whether a source is complete, valid Mermaid.
 * @param {(host: HTMLElement, source: string, hooks: { onError: () => void }) => { update(source: string): void, refresh(): void, unmount(): void }} options.mount - Render a diagram into a host.
 * @param {typeof MutationObserver} [options.Observer] - Mutation observer constructor.
 * @returns {{ refresh(): void, dispose(): void, scan(): Promise<void> }} Controller.
 */
export function createEnhancer({ container, validate, mount, Observer = globalThis.MutationObserver }) {
  /** @type {Map<Element, { source: string, update(source: string): void, refresh(): void, dispose(): void }>} */
  const entries = new Map();
  /** Last code tried per block, so an unchanged invalid block is not re-parsed. */
  const tried = new WeakMap();
  /** Code whose rendering failed per block; that block stays as plain code. */
  const failed = new WeakMap();
  let timer = null;
  let disposed = false;
  let scanning = false;
  let rescan = false;

  const queue = () => {
    if (disposed) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void scan();
    }, SETTLE_MS);
  };

  const release = (block) => {
    const entry = entries.get(block);
    if (entry === undefined) return;
    entries.delete(block);
    entry.dispose();
  };

  const adopt = (block, source) => {
    const host = document.createElement('div');
    host.setAttribute(HOST_ATTR, '');
    host.className = 'mmd-host';
    block.after(host);
    block.setAttribute(HIDDEN_ATTR, '');
    const mounted = mount(host, source, {
      onError: () => {
        failed.set(block, entry.source);
        release(block);
      },
    });
    const entry = {
      source,
      update(next) {
        entry.source = next;
        mounted.update(next);
      },
      refresh: () => mounted.refresh(),
      dispose() {
        mounted.unmount();
        host.remove();
        block.removeAttribute(HIDDEN_ATTR);
      },
    };
    entries.set(block, entry);
  };

  async function scan() {
    if (disposed) return;
    if (scanning) {
      rescan = true;
      return;
    }
    scanning = true;
    try {
      for (const block of [...entries.keys()]) if (!block.isConnected) release(block);
      for (const block of container.querySelectorAll(BLOCK_SELECTOR)) {
        if (disposed) return;
        if (block.closest(`[${HOST_ATTR}]`) != null) continue;
        const source = sourceOfBlock(block);
        const entry = entries.get(block);
        if (entry !== undefined) {
          // Streaming rewrites the code in place; follow it while it stays valid.
          if (source !== entry.source && source !== '' && (await validate(source)) && block.isConnected) entry.update(source);
          continue;
        }
        if (source === '' || mermaidType(source) === '') continue;
        if (tried.get(block) === source || failed.get(block) === source) continue;
        tried.set(block, source);
        if (!(await validate(source)) || disposed || !block.isConnected) continue;
        adopt(block, source);
      }
    } finally {
      scanning = false;
      if (rescan) {
        rescan = false;
        queue();
      }
    }
  }

  const observer = new Observer((records) => {
    if (records.every(isOwnMutation)) return;
    queue();
  });
  observer.observe(container, { childList: true, subtree: true, characterData: true });
  queue();

  return {
    scan,
    refresh() {
      for (const entry of entries.values()) entry.refresh();
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      for (const block of [...entries.keys()]) release(block);
    },
  };
}
