/**
 * Pure Markdown-to-diagram extraction, kept free of React and Mermaid so it can
 * be exercised directly.
 */

const OPEN_FENCE = /^\s{0,3}(`{3,}|~{3,})\s*(.*)$/;

/** First-line patterns for the diagram types Mermaid can render. */
const TYPE_KEYS = [
  [/^(flowchart|graph)(\s+(TB|TD|BT|RL|LR))?\s*$/i, 'flowchart'],
  [/^sequenceDiagram\b/i, 'sequence'],
  [/^classDiagram(-v2)?\b/i, 'class'],
  [/^stateDiagram(-v2)?\b/i, 'state'],
  [/^erDiagram\b/i, 'er'],
  [/^gantt\b/i, 'gantt'],
  [/^pie\b/i, 'pie'],
  [/^journey\b/i, 'journey'],
  [/^mindmap\b/i, 'mindmap'],
  [/^timeline\b/i, 'timeline'],
  [/^quadrantChart\b/i, 'quadrant'],
  [/^sankey(-beta)?\b/i, 'sankey'],
  [/^xychart(-beta)?\b/i, 'xy'],
  [/^block(-beta)?\s*$/i, 'block'],
  [/^architecture(-beta)?\s*$/i, 'architecture'],
  [/^gitGraph\b/i, 'git'],
  [/^C4(Context|Container|Component|Dynamic|Deployment)\b/i, 'c4'],
  [/^requirementDiagram\b/i, 'requirement'],
  [/^packet(-beta)?\s*$/i, 'packet'],
  [/^kanban\s*$/i, 'kanban'],
  [/^radar(-beta)?\s*$/i, 'radar'],
];

/**
 * Classify a Mermaid source by its first meaningful line.
 * @param {string} source - Mermaid source.
 * @returns {string} Diagram type key, or an empty string when unknown.
 */
export function mermaidType(source) {
  const first = source
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('%%'));
  if (first === undefined) return '';
  for (const [pattern, key] of TYPE_KEYS) {
    if (pattern.test(first)) return key;
  }
  return '';
}

/**
 * Collect every fenced Mermaid block of one Markdown text, in document order.
 * Fences of any length and both marker characters are accepted; a block is
 * only reported for the `mermaid` info string.
 * @param {string} text - Assistant Markdown.
 * @returns {string[]} Mermaid sources.
 */
export function extractMermaid(text) {
  const blocks = [];
  let fence = null;
  let buffer = null;
  for (const line of text.split('\n')) {
    const match = OPEN_FENCE.exec(line);
    if (fence === null) {
      if (match === null) continue;
      const info = match[2].trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      fence = match[1];
      buffer = info === 'mermaid' ? [] : null;
      continue;
    }
    if (match !== null && match[2].trim() === '' && match[1][0] === fence[0] && match[1].length >= fence.length) {
      if (buffer !== null && buffer.length > 0) {
        const source = buffer.join('\n').trim();
        if (source !== '') blocks.push(source);
      }
      fence = null;
      buffer = null;
      continue;
    }
    if (buffer !== null) buffer.push(line);
  }
  return blocks;
}

/**
 * Collect a Turn's Mermaid sources from its assistant steps, de-duplicated.
 * @param {readonly any[] | undefined} steps - Assistant step payloads of the Turn.
 * @returns {{ source: string, type: string }[]} Diagram descriptors.
 */
export function diagramsOf(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return [];
  const seen = new Set();
  const diagrams = [];
  for (const step of steps) {
    const blocks = step?.blocks;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (block?.kind !== 'text' || typeof block.text !== 'string') continue;
      for (const source of extractMermaid(block.text)) {
        if (seen.has(source)) continue;
        seen.add(source);
        diagrams.push({ source, type: mermaidType(source) });
      }
    }
  }
  return diagrams;
}
