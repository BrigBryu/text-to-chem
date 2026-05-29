import { COLOR_THEME } from "./colorTheme.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function drawArrows(svg, arrows, anchorRegistry) {
  if (!arrows || arrows.length === 0) {
    return [];
  }

  const unresolved = [];
  const layer = makeSvgElement("g", {
    class: "chem-arrow-layer",
    "aria-hidden": "true"
  });
  const markerId = ensureArrowMarker(svg);

  arrows.forEach((arrow, index) => {
    const from = resolveArrowEndpoint(arrow.from, anchorRegistry);
    const to = resolveArrowEndpoint(arrow.to, anchorRegistry);

    if (!from || !to) {
      if (!from) {
        unresolved.push(arrow.from);
      }
      if (!to) {
        unresolved.push(arrow.to);
      }
      return;
    }

    layer.appendChild(drawCurvedArrow(from, to, {
      markerId,
      curve: arrow.curve,
      index
    }));
  });

  if (layer.childNodes.length > 0) {
    svg.appendChild(layer);
  }

  return unresolved;
}

export function resolveArrowEndpoint(ref, anchorRegistry) {
  const cleanRef = String(ref || "").trim();
  if (!cleanRef) {
    return null;
  }

  if (anchorRegistry.has(cleanRef)) {
    return anchorRegistry.get(cleanRef);
  }

  const bond = parseBondRef(cleanRef);
  if (bond) {
    return resolveBondEndpoint(bond, anchorRegistry);
  }

  return null;
}

function drawCurvedArrow(fromAnchor, toAnchor, options) {
  const start = offsetEndpoint(fromAnchor, toAnchor, 7);
  const end = offsetEndpoint(toAnchor, fromAnchor, endpointInset(toAnchor));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normal = getCurveNormal(dx, dy, options.curve, options.index);
  const curveAmount = Math.min(42, Math.max(18, distance * 0.24));
  const control = {
    x: (start.x + end.x) / 2 + normal.x * curveAmount,
    y: (start.y + end.y) / 2 + normal.y * curveAmount
  };

  return makeSvgElement("path", {
    class: "chem-arrow",
    fill: "none",
    stroke: COLOR_THEME.arrow.color,
    opacity: COLOR_THEME.arrow.opacity,
    "stroke-width": "2.2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    d: `M ${round(start.x)} ${round(start.y)} Q ${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
    "marker-end": `url(#${options.markerId})`
  });
}

function resolveBondEndpoint(bond, anchorRegistry) {
  const directKey = `${bond.a}-${bond.b}`;
  const reverseKey = `${bond.b}-${bond.a}`;
  if (anchorRegistry.has(directKey)) {
    return anchorRegistry.get(directKey);
  }
  if (anchorRegistry.has(reverseKey)) {
    return anchorRegistry.get(reverseKey);
  }

  return null;
}

function parseBondRef(ref) {
  const match = ref.match(/^([A-Z][a-z]?\d+)-([A-Z][a-z]?\d+)$/);
  if (!match) {
    return null;
  }

  return {
    a: match[1],
    b: match[2]
  };
}

function makeBondAnchor(a, b, key) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    type: "bond",
    key,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    angle: Math.atan2(dy, dx),
    normal: { x: -dy / length, y: dx / length }
  };
}

function offsetEndpoint(anchor, other, distance) {
  if (anchor.type === "bond") {
    const normal = anchor.normal || { x: 0, y: -1 };
    return {
      x: anchor.x + normal.x * 7,
      y: anchor.y + normal.y * 7
    };
  }

  const dx = other.x - anchor.x;
  const dy = other.y - anchor.y;
  const length = Math.hypot(dx, dy) || 1;
  const direction = anchor.type === "lonePair" ? -1 : 1;

  return {
    x: anchor.x + (dx / length) * distance * direction,
    y: anchor.y + (dy / length) * distance * direction
  };
}

function endpointInset(anchor) {
  if (anchor.type === "atom" || anchor.type === "pseudoHydrogen") {
    return 17;
  }
  if (anchor.type === "bond") {
    return 0;
  }
  return 8;
}

function getCurveNormal(dx, dy, curve, index) {
  const length = Math.hypot(dx, dy) || 1;
  const sign = curve === "left" ? 1 : curve === "right" ? -1 : index % 2 === 0 ? 1 : -1;
  return {
    x: (-dy / length) * sign,
    y: (dx / length) * sign
  };
}

function ensureArrowMarker(svg) {
  const markerId = `arrowhead-${svg.dataset.arrowMarkerId || Math.random().toString(36).slice(2)}`;
  svg.dataset.arrowMarkerId = markerId.replace(/^arrowhead-/, "");

  if (svg.querySelector(`#${markerId}`)) {
    return markerId;
  }

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = makeSvgElement("defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  const marker = makeSvgElement("marker", {
    id: markerId,
    viewBox: "0 0 10 10",
    refX: "8",
    refY: "5",
    markerWidth: "6",
    markerHeight: "6",
    orient: "auto-start-reverse"
  });
  marker.appendChild(makeSvgElement("path", {
    d: "M 0 0 L 10 5 L 0 10 z",
    class: "chem-arrow-head",
    fill: COLOR_THEME.arrow.color,
    opacity: COLOR_THEME.arrow.opacity
  }));
  defs.appendChild(marker);

  return markerId;
}

function makeSvgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
