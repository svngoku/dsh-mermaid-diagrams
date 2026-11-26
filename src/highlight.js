/**
 * Mermaid syntax tags for the viewer's code pane.
 *
 * Pele parses diagrams but keeps no token positions, and no general-purpose
 * grammar colors Mermaid well, so this module tags a source line by line with
 * the structure that matters when reading a diagram: diagram keywords,
 * comments, quoted and bracketed labels, arrows, style names and element ids.
 * It has no dependencies and never throws; every token is HTML-escaped.
 */

const ROLE_KEYWORD = 'keyword';
const ROLE_NAME = 'name';
const ROLE_LABEL = 'label';
const ROLE_OPERATOR = 'operator';
const ROLE_COMMENT = 'comment';

/** Diagram keywords, statements and directions. */
const KEYWORDS = new Set([
  'flowchart', 'graph', 'sequenceDiagram', 'classDiagram', 'classDiagram-v2', 'stateDiagram',
  'stateDiagram-v2', 'erDiagram', 'gantt', 'pie', 'journey', 'mindmap', 'timeline', 'quadrantChart',
  'sankey-beta', 'xychart-beta', 'block-beta', 'architecture-beta', 'gitGraph', 'C4Context',
  'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment', 'requirementDiagram', 'packet-beta',
  'kanban', 'radar-beta', 'treemap-beta', 'treeView-beta', 'venn-beta', 'usecase-beta', 'wardley-beta',
  'cynefin-beta', 'ishikawa-beta', 'eventmodeling', 'swimlane-beta', 'agentflow-beta', 'info',
  'subgraph', 'end', 'participant', 'actor', 'note', 'loop', 'alt', 'else', 'opt', 'par', 'and',
  'critical', 'break', 'rect', 'activate', 'deactivate', 'autonumber', 'class', 'state', 'section',
  'click', 'linkStyle', 'classDef', 'style', 'direction', 'title', 'accTitle', 'accDescr', 'over',
  'branch', 'checkout', 'commit', 'merge', 'cherry-pick', 'tag', 'group', 'service', 'junction',
  'TB', 'TD', 'BT', 'RL', 'LR', 'showData',
]);

/** Words that introduce a declared name rather than a plain id. */
const TYPE_INTRODUCERS = new Set(['class', 'state', 'participant', 'actor', 'group', 'service', 'subgraph', 'branch', 'checkout', 'tag', 'over']);

/** Anchored token: comment, label, arrow, word, or whitespace. */
const TOKEN = /^(%%.*$)|^("[^"]*")|^(\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|\|[^|]*\|)|^(<-->|<-.->|==>|-.->|-->|->>|-->>|--x|--\)|-x|-\)|:::|---|--|->)|^([A-Za-z_][A-Za-z0-9_-]*)|^(\s+)/u;

/**
 * Escape text for safe insertion as HTML.
 * @param {string} text - Raw text.
 * @returns {string} Escaped text.
 */
function escapeHtml(text) {
  return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

/**
 * Wrap one token in a role span, or leave it plain.
 * @param {string} text - Token text.
 * @param {string} role - Role key, or an empty string.
 * @returns {string} HTML.
 */
function render(text, role) {
  const safe = escapeHtml(text);
  return role === '' ? safe : `<span class="mmd-tok-${role}">${safe}</span>`;
}

/**
 * Role of a bare word in context.
 * @param {string} word - Bare word.
 * @param {boolean} lineStart - Whether it is the first word of the line.
 * @param {string | undefined} previous - Previous significant word.
 * @returns {string} Role key.
 */
function roleOf(word, lineStart, previous) {
  if (KEYWORDS.has(word) || lineStart) return KEYWORDS.has(word) ? ROLE_KEYWORD : ROLE_NAME;
  if (previous !== undefined && TYPE_INTRODUCERS.has(previous)) return ROLE_NAME;
  return '';
}

/**
 * Tag one source line.
 * @param {string} line - Source line.
 * @returns {string} HTML for the line.
 */
export function highlightLine(line) {
  const out = [];
  let lineStart = true;
  let previous;
  let index = 0;
  while (index < line.length) {
    const rest = line.slice(index);
    const match = TOKEN.exec(rest);
    if (match === null) {
      const char = rest.charAt(0);
      out.push(/^\s$/u.test(char) ? char : render(char, ROLE_OPERATOR));
      index += 1;
      continue;
    }
    const whole = match[0];
    if (match[1] !== undefined) {
      out.push(render(whole, ROLE_COMMENT));
      break;
    }
    if (match[2] !== undefined || match[3] !== undefined) {
      out.push(render(whole, ROLE_LABEL));
    } else if (match[4] !== undefined) {
      out.push(render(whole, ROLE_OPERATOR));
    } else if (match[5] !== undefined) {
      out.push(render(whole, roleOf(whole, lineStart, previous)));
      previous = whole;
      lineStart = false;
    } else {
      out.push(whole);
    }
    if (whole.trim() !== '') lineStart = false;
    index += whole.length;
  }
  return out.join('');
}

/**
 * Tag every line of a source, keeping the line structure for an overlay.
 * @param {string} source - Mermaid source.
 * @returns {string[]} One HTML string per line.
 */
export function highlightLines(source) {
  return source.split('\n').map((line) => highlightLine(line));
}
