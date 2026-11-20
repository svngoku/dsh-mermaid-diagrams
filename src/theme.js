/** Mermaid theme matching the reference grayscale diagrams. */

/** Flat grayscale palettes matching the reference diagrams. */
const PALETTES = {
  light: {
    ink: '#111111', soft: '#6b6b6b', line: '#8a8a8a', faint: '#e4e4e4',
    node: '#e8e8e8', nodeStroke: '#d6d6d6', head: '#e4e4e4', cell: '#f3f3f3',
    note: '#f3f3f3', dot: '#999999', canvas: 'transparent', label: '#f1f1f1',
  },
  dark: {
    ink: '#eeeeee', soft: '#a8a8a8', line: '#7d7d7d', faint: '#3a3a3a',
    node: '#2f2f2f', nodeStroke: '#444444', head: '#383838', cell: '#262626',
    note: '#262626', dot: '#8a8a8a', canvas: 'transparent', label: '#262626',
  },
};

/**
 * Mermaid theme variables for one scheme: neutral gray surfaces, hairline
 * strokes, host font, small type.
 * @param {'light' | 'dark'} scheme - Active scheme.
 * @param {string} [family] - Host font family list.
 * @returns {Record<string, string>} Theme variables.
 */
export function themeVariablesFor(scheme, family = '') {
  const c = PALETTES[scheme];
  return {
    ...(family === '' ? {} : { fontFamily: family }),
    fontSize: '13px',
    background: c.canvas,
    primaryColor: c.node, primaryBorderColor: c.nodeStroke, primaryTextColor: c.ink,
    secondaryColor: c.node, secondaryBorderColor: c.nodeStroke, secondaryTextColor: c.ink,
    tertiaryColor: c.cell, tertiaryBorderColor: c.faint, tertiaryTextColor: c.ink,
    mainBkg: c.node, nodeBorder: c.nodeStroke, nodeTextColor: c.ink,
    lineColor: c.line, textColor: c.ink, titleColor: c.ink,
    clusterBkg: 'transparent', clusterBorder: c.faint,
    edgeLabelBackground: c.label,
    // sequence
    actorBkg: c.head, actorBorder: scheme === 'dark' ? '#8a8a8a' : '#444444', actorTextColor: c.ink,
    actorLineColor: c.line, signalColor: c.ink, signalTextColor: c.ink,
    labelBoxBkgColor: c.cell, labelBoxBorderColor: c.faint, labelTextColor: c.ink,
    loopTextColor: c.ink, noteBkgColor: c.note, noteBorderColor: c.faint, noteTextColor: c.ink,
    activationBkgColor: c.head, activationBorderColor: c.line, sequenceNumberColor: c.ink,
    // state
    stateBkg: c.node, stateLabelColor: c.ink, altBackground: c.cell,
    compositeBackground: 'transparent', compositeBorder: c.faint, compositeTitleBackground: c.cell,
    transitionColor: c.line, transitionLabelColor: c.ink, specialStateColor: c.dot,
    innerEndBackground: c.ink, labelColor: c.ink,
    // class / er
    classText: c.ink, attributeBackgroundColorOdd: c.cell, attributeBackgroundColorEven: c.canvas === 'transparent' ? (scheme === 'dark' ? '#202020' : '#ffffff') : c.canvas,
  };
}

/**
 * Extra SVG rules that Mermaid variables cannot express: rounded nodes, hairline
 * edges, small arrowheads, dashed returns.
 * @param {'light' | 'dark'} scheme - Active scheme.
 * @returns {string} CSS appended to every diagram.
 */
export function themeCssFor(scheme) {
  const c = PALETTES[scheme];
  return `
    .node, .node *, .actor, .entityBox, .statediagram-state, .cluster rect, .label-container, .basic { filter: none !important; drop-shadow: none; }
    .node rect, .node polygon, .node circle, .node ellipse, .node path { stroke-width: 1px; }
    .node rect { rx: 14px; ry: 14px; }
    .cluster rect { rx: 4px; ry: 4px; stroke-width: 1px; }
    .cluster-label text, .cluster-label span, .cluster-label p { font-size: 12px; fill: ${c.ink}; color: ${c.ink}; }
    .edgePath .path, .flowchart-link, .transition, .messageLine0, .messageLine1, .relation, .edge-pattern-solid { stroke-width: 1px; }
    .messageLine1 { stroke-dasharray: 2 2; }
    .marker, .arrowMarkerPath, #arrowhead path, marker path { fill: ${c.line}; stroke: ${c.line}; stroke-width: 0.5px; }
    .edgeLabel, .edgeLabel p, .edgeLabel span { font-size: 12px; color: ${c.ink}; background-color: transparent; }
    .edgeLabel rect, .labelBkg { opacity: 1; fill: ${c.label}; background-color: ${c.label}; }
    .actor { stroke-width: 1px; rx: 0; }
    .actor-line { stroke-width: 1px; }
    text.actor > tspan { fill: ${c.ink}; }
    .messageText, .noteText, .loopText, .labelText, .labelText > tspan { font-size: 12px !important; fill: ${c.ink}; }
    text.actor, text.actor > tspan { font-size: 13px !important; font-weight: 400; }
    .loopLine { stroke-width: 1px; stroke-dasharray: 2 3; stroke: ${c.faint}; }
    .statediagram-state rect, .stateGroup rect { rx: 10px; ry: 10px; }
    .state-start circle, .start-state { fill: ${c.dot}; stroke: ${c.dot}; }
    .end-state-outer { fill: ${c.node}; stroke: ${c.dot}; }
    .end-state-inner { fill: ${c.ink}; }
    .entityBox { stroke-width: 1px; }
    .relationshipLine { stroke-width: 1px; }
    .relationshipLabel { font-size: 12px; fill: ${c.ink}; }
  `;
}

