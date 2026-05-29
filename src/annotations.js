import { COLOR_THEME } from "./colorTheme.js";

const ELEMENT_PATTERN = /^([A-Z][a-z]?)(\d+)$/;
const SVG_NS = "http://www.w3.org/2000/svg";

export function resolveAtomRefs(molData, atoms) {
  const refs = new Map();
  const elementCounts = new Map();

  atoms.forEach((atom) => {
    const element = atom.element;
    const nextCount = (elementCounts.get(element) || 0) + 1;
    elementCounts.set(element, nextCount);
    refs.set(`${element}${nextCount}`, atom);
  });

  return refs;
}

export function drawAtomAnnotations(svg, atomRef, atom, annotations) {
  const lonePairCount = Math.max(0, Number.parseInt(annotations.lonePairs || 0, 10) || 0);
  const charge = normalizeCharge(annotations.charge);
  const items = [
    ...Array.from({ length: lonePairCount }, () => ({ type: "lonePair" })),
    ...(charge ? [{ type: "charge", value: charge }] : [])
  ];

  if (items.length === 0) {
    return new Map();
  }

  const anchors = new Map();
  const group = makeSvgElement("g", {
    class: "chem-annotation chem-atom-annotations",
    "aria-hidden": "true"
  });

  const slots = getAnnotationSlots(atom, items.length);
  items.forEach((item, index) => {
    const slot = slots[index];
    const scale = getAnnotationScale(atom);
    const x = atom.x + slot.dx * scale;
    const y = atom.y + slot.dy * scale;
    if (item.type === "lonePair") {
      drawPair(group, x, y, slot.angle, scale);
      const lonePairIndex = anchorsOfType(anchors, `${atomRef}.lp`) + 1;
      anchors.set(`${atomRef}.lp${lonePairIndex}`, {
        type: "lonePair",
        x,
        y,
        angle: slot.angle,
        atom
      });
    } else {
      drawCharge(group, x, y, item.value, scale);
      anchors.set(`${atomRef}.charge`, {
        type: "charge",
        x,
        y,
        angle: slot.angle,
        atom
      });
    }
  });

  svg.appendChild(group);
  return anchors;
}

function drawCharge(group, x, y, charge, scale) {
  const fontSize = clamp(14 * scale, 9.5, 19);
  const text = makeSvgElement("text", {
    class: "chem-annotation chem-charge",
	    x,
	    y,
	    "text-anchor": "middle",
	    fill: COLOR_THEME.molecule.C,
    "font-size": fontSize,
    "font-weight": "700",
    "dominant-baseline": "middle"
  });
  text.textContent = charge;
  group.appendChild(text);
}

function drawPair(group, x, y, angle, scale) {
  const tangentAngle = angle + Math.PI / 2;
  const dotSpacing = clamp(2.8 * scale, 1.8, 4);
  const radius = clamp(2 * scale, 1.35, 3);
  const tx = Math.cos(tangentAngle) * dotSpacing;
  const ty = Math.sin(tangentAngle) * dotSpacing;

  group.appendChild(
    makeSvgElement("circle", {
	      cx: x - tx,
	      cy: y - ty,
	      r: radius,
	      fill: COLOR_THEME.molecule.C
    })
  );
  group.appendChild(
    makeSvgElement("circle", {
	      cx: x + tx,
	      cy: y + ty,
	      r: radius,
	      fill: COLOR_THEME.molecule.C
	    })
  );
}

function getAnnotationSlots(atom, count) {
  const candidates = [
    slot(0, -28),
    slot(22, -22),
    slot(30, 0),
    slot(22, 22),
    slot(0, 28),
    slot(-22, 22),
    slot(-30, 0),
    slot(-22, -22)
  ];

  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreSlot(atom, candidate)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.angle - b.angle);
}

function scoreSlot(atom, candidate) {
  const neighborAngles = (atom.neighbors || []).map((neighbor) => Math.atan2(neighbor.y - atom.y, neighbor.x - atom.x));
  const awayFromBonds = neighborAngles.length
    ? Math.min(...neighborAngles.map((angle) => angularDistance(candidate.angle, angle)))
    : Math.PI;
  const verticalPreference = candidate.dy < 0 ? 0.18 : 0;
  const diagonalPreference = candidate.dx !== 0 && candidate.dy !== 0 ? 0.08 : 0;

  return awayFromBonds + verticalPreference + diagonalPreference;
}

function slot(dx, dy) {
  return {
    dx,
    dy,
    angle: Math.atan2(dy, dx)
  };
}

function angularDistance(a, b) {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

function normalizeCharge(charge) {
  const raw = String(charge || "").trim();
  if (!raw) {
    return "";
  }
  if (raw === "+1") {
    return "+";
  }
  if (raw === "-1") {
    return "-";
  }
  return raw;
}

function makeSvgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function getAnnotationScale(atom) {
  return Number.isFinite(atom.annotationScale) ? atom.annotationScale : 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function anchorsOfType(anchors, prefix) {
  return Array.from(anchors.keys()).filter((key) => key.startsWith(prefix)).length;
}

export function atomRefLooksValid(atomRef) {
  return ELEMENT_PATTERN.test(atomRef);
}
