/**
 * Offline checks that need no browser.
 *
 *  1. The in-place enhancer, driven against a small fake DOM: it replaces valid
 *     Mermaid blocks, leaves other code alone, follows streaming edits, honors a
 *     render failure, and restores every block on dispose.
 *  2. The built `client.js`: it evaluates through the module loader, exposes
 *     `apply`/`inject`, and its `apply` installs styles, dictionaries and the
 *     enhancer, then cleans up.
 *
 * It cannot prove how a diagram looks in the running page.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createEnhancer, HIDDEN_ATTR, HOST_ATTR } from '../src/enhancer.js';
import { diagramsOf, extractMermaid, mermaidType } from '../src/mermaid-source.js';

const root = dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);

//#region fake DOM

class FakeNode {
  constructor() {
    this.attrs = new Map();
    this.parent = null;
    this.className = '';
    this.nodeType = 1;
  }

  setAttribute(name, value) {
    this.attrs.set(name, value);
  }

  removeAttribute(name) {
    this.attrs.delete(name);
  }

  hasAttribute(name) {
    return this.attrs.has(name);
  }

  get isConnected() {
    return this.detached !== true;
  }

  closest(selector) {
    const attr = /^\[(.+)\]$/.exec(selector)?.[1];
    for (let node = this; node !== null; node = node.parent) if (attr !== undefined && node.hasAttribute(attr)) return node;
    return null;
  }

  after(node) {
    node.parent = this.parent;
    this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, node);
  }

  remove() {
    if (this.parent === null) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}

class FakeBlock extends FakeNode {
  constructor(text) {
    super();
    this.text = text;
  }

  querySelector() {
    return { textContent: this.text };
  }
}

class FakeContainer extends FakeNode {
  constructor() {
    super();
    this.children = [];
  }

  add(block) {
    block.parent = this;
    this.children.push(block);
    return block;
  }

  querySelectorAll() {
    return this.children.filter((child) => child instanceof FakeBlock);
  }
}

class FakeObserver {
  static last = null;

  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    FakeObserver.last = this;
  }

  observe() {}

  disconnect() {
    this.disconnected = true;
  }
}

globalThis.document = {
  createElement: () => new FakeNode(),
};

//#endregion

//#region enhancer

const FLOW = 'flowchart TD\n  A --> B';
const FLOW_2 = 'flowchart TD\n  A --> B\n  B --> C';

function harness(validate = async () => true) {
  const container = new FakeContainer();
  const mounts = [];
  const validated = [];
  const enhancer = createEnhancer({
    container,
    validate: async (source) => {
      validated.push(source);
      return validate(source);
    },
    mount(host, source, hooks) {
      const record = { host, source, updates: [], refreshed: 0, unmounted: false, hooks };
      mounts.push(record);
      return {
        update: (next) => record.updates.push(next),
        refresh: () => {
          record.refreshed += 1;
        },
        unmount: () => {
          record.unmounted = true;
        },
      };
    },
    Observer: FakeObserver,
  });
  return { container, mounts, validated, enhancer };
}

{
  // A valid Mermaid block is replaced by a host and hidden.
  const { container, mounts, enhancer } = harness();
  const mermaid = container.add(new FakeBlock(FLOW));
  const plain = container.add(new FakeBlock('const answer = 42;'));
  await enhancer.scan();
  assert.equal(mounts.length, 1, 'one diagram mounted');
  assert.equal(mounts[0].source, FLOW);
  assert.ok(mermaid.hasAttribute(HIDDEN_ATTR), 'mermaid block hidden');
  assert.ok(!plain.hasAttribute(HIDDEN_ATTR), 'plain code untouched');
  assert.ok(mounts[0].host.hasAttribute(HOST_ATTR), 'host marked');
  assert.equal(container.children.indexOf(mounts[0].host), container.children.indexOf(mermaid) + 1, 'host sits right after the block');

  // Re-scanning an unchanged block neither re-mounts nor re-validates it.
  await enhancer.scan();
  assert.equal(mounts.length, 1, 'no duplicate mount');

  // Streaming rewrites the code in place; the card follows while it stays valid.
  mermaid.text = FLOW_2;
  await enhancer.scan();
  assert.deepEqual(mounts[0].updates, [FLOW_2], 'card follows streaming edits');

  enhancer.refresh();
  assert.equal(mounts[0].refreshed, 1, 'refresh reaches mounted cards');

  // Dispose restores the original block.
  enhancer.dispose();
  assert.ok(!mermaid.hasAttribute(HIDDEN_ATTR), 'block restored');
  assert.ok(mounts[0].unmounted, 'card unmounted');
  assert.equal(container.children.length, 2, 'host removed');
  assert.ok(FakeObserver.last.disconnected, 'observer disconnected');
}

{
  // Mermaid-looking but invalid code stays as code and is parsed once per edit.
  const { container, mounts, validated, enhancer } = harness(async () => false);
  const block = container.add(new FakeBlock(FLOW));
  await enhancer.scan();
  await enhancer.scan();
  assert.equal(mounts.length, 0, 'invalid code not replaced');
  assert.ok(!block.hasAttribute(HIDDEN_ATTR));
  assert.equal(validated.length, 1, 'unchanged invalid block validated once');
  enhancer.dispose();
}

{
  // A render failure puts the code block back and never retries that source.
  const { container, mounts, enhancer } = harness();
  const block = container.add(new FakeBlock(FLOW));
  await enhancer.scan();
  mounts[0].hooks.onError();
  assert.ok(!block.hasAttribute(HIDDEN_ATTR), 'failed diagram falls back to code');
  assert.ok(mounts[0].unmounted);
  await enhancer.scan();
  assert.equal(mounts.length, 1, 'failed source is not retried');
  enhancer.dispose();
}

{
  // A block that left the document releases its card.
  const { container, mounts, enhancer } = harness();
  const block = container.add(new FakeBlock(FLOW));
  await enhancer.scan();
  block.detached = true;
  await enhancer.scan();
  assert.ok(mounts[0].unmounted, 'orphaned card released');
  enhancer.dispose();
}

{
  // Source-level helpers.
  assert.deepEqual(extractMermaid('```mermaid\npie\n"a": 1\n```'), ['pie\n"a": 1']);
  assert.equal(mermaidType('block of text'), '');
  assert.equal(mermaidType('%% note\nsequenceDiagram\n A->>B: hi'), 'sequence');
  assert.equal(diagramsOf([{ blocks: [{ kind: 'text', text: '```mermaid\nerDiagram\n```' }] }]).length, 1);
}

//#endregion

//#region built bundle

const source = await readFile(resolve(root, '../client.js'), 'utf8');
const loaded = [];
const context = vm.createContext({
  window: { __ModuleLoader__: { load: (entry) => loaded.push(entry) } },
  console,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  URL,
  Blob: globalThis.Blob,
  navigator: { clipboard: { writeText: async () => {} } },
  MutationObserver: FakeObserver,
  document: undefined,
});

const head = new FakeContainer();
head.append = (node) => {
  node.parent = head;
  head.children.push(node);
};
context.document = {
  head,
  body: new FakeContainer(),
  createElement: () => {
    const node = new FakeNode();
    node.remove = () => {
      node.removed = true;
    };
    return node;
  },
};
vm.runInContext(source, context, { filename: 'client.js' });

assert.equal(loaded.length, 1, 'bundle registers one factory');
assert.equal(loaded[0].id, '@local/mermaid-diagrams');

const React = nodeRequire('react');
const exports = loaded[0].factory((specifier) => {
  if (specifier === 'react') return React;
  if (specifier === 'react/jsx-runtime') return nodeRequire('react/jsx-runtime');
  if (specifier === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() {} }) };
  throw new Error(`unexpected require(${JSON.stringify(specifier)})`);
});
assert.equal(typeof exports.apply, 'function', 'apply exported');
assert.equal(JSON.stringify(exports.inject), JSON.stringify(['locale', 'theme']));

const effects = [];
const dictionaries = [];
const listeners = new Map();
const disposers = [];
exports.apply({
  theme: { getTheme: () => ({ active: { colorScheme: 'light' } }) },
  locale: {
    register: (ns, locale, dict) => {
      dictionaries.push(`${ns}:${locale}:${Object.keys(dict).length}`);
      return () => {};
    },
    bind: () => (key) => key,
  },
  effect(factory, label) {
    effects.push(label);
    const dispose = factory();
    if (typeof dispose === 'function') disposers.push(dispose);
    return dispose;
  },
  on(event, handler) {
    listeners.set(event, handler);
    return () => {};
  },
});

assert.deepEqual(dictionaries.map((entry) => entry.split(':').slice(0, 2).join(':')), ['mermaid:en', 'mermaid:fr']);
assert.equal(head.children.length, 1, 'styles installed');
assert.ok(head.children[0].textContent.includes('[data-mmd-hidden]'), 'hide rule present');
assert.ok(head.children[0].textContent.includes('var(--dsw-alias-border-l1)') || head.children[0].textContent.includes('--dsw-alias'), 'theme tokens used');
assert.ok(effects.includes('mermaid-diagrams: code block enhancer'), 'enhancer registered');
assert.ok(listeners.has('theme/change') && listeners.has('locale/change'));
listeners.get('theme/change')({ active: { colorScheme: 'dark' } });
listeners.get('locale/change')();
for (const dispose of disposers.reverse()) dispose();
assert.ok(head.children[0].removed, 'styles removed on dispose');
assert.ok(FakeObserver.last.disconnected, 'bundle observer disconnected on dispose');

//#endregion

console.log('smoke: ok');
console.log('  enhancer   replace, skip, stream, fail-back, orphan, dispose');
console.log(`  bundle     ${loaded[0].id} exports ${Object.keys(exports).sort().join(', ')}`);
console.log(`  effects    ${effects.length}  dictionaries ${dictionaries.join(' ')}`);
