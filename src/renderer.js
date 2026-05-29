import SmilesDrawer from "smiles-drawer";
import { atomRefLooksValid, drawAtomAnnotations, resolveAtomRefs } from "./annotations.js";
import { drawArrows } from "./arrows.js";
import { COLOR_THEME } from "./colorTheme.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const COMPONENT_CACHE = new Map();
const CARD_VIEWBOX = { width: 520, height: 300 };
let svgInstanceId = 0;

const DRAW_OPTIONS = {
  width: CARD_VIEWBOX.width,
  height: CARD_VIEWBOX.height,
  bondThickness: 1.8,
  bondLength: 42,
  shortBondLength: 0.78,
  atomVisualization: "default",
  explicitHydrogens: true,
  terminalCarbons: false,
  showCarbons: "default",
  compactDrawing: false,
  fontFamily: "Inter, Arial, sans-serif",
  fontSizeLarge: 14,
  fontSizeSmall: 10,
  padding: 30,
  themes: {
    note: {
      ...COLOR_THEME.molecule
    }
  }
};

export async function renderMoleculeCard(molData, index, renderSettings = {}, renderContext = {}) {
  const card = document.createElement("article");
  card.className = "molecule-card";
  card.dataset.title = molData.title || `Molecule ${index + 1}`;

  const moleculeArea = document.createElement("div");
  moleculeArea.className = "molecule-area";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("molecule-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${molData.title || "Molecule"} structure`);
  moleculeArea.appendChild(svg);

  const body = document.createElement("div");
  body.className = "molecule-body";
  body.innerHTML = `
    <div class="card-heading">
      <h2>${escapeHtml(molData.title || `Molecule ${index + 1}`)}</h2>
      <div class="card-actions" aria-label="Export actions">
        <button type="button" data-action="download-svg">SVG</button>
        <button type="button" data-action="download-png">PNG</button>
      </div>
    </div>
    <p>${escapeHtml(molData.caption || "")}</p>
    <div class="annotation-warning" hidden></div>
  `;

  card.append(moleculeArea, body);

  try {
    const atoms = await drawSmiles(svg, getDisplaySmiles(molData), renderSettings);
    const refs = resolveAtomRefs(molData, atoms);
    const layoutWarnings = applyRequestedLayout(svg, refs, molData, renderContext);
    const anchorRegistry = buildAnchorRegistry(refs);
    if (getRenderMode(renderSettings) === "expandedHydrogens") {
      drawExpandedHydrogens(svg, atoms);
    }
    if (molData.show_atom_labels) {
      drawAtomRefLabels(svg, refs);
    }
    const annotationResult = applyAnnotations(svg, refs, molData);
    annotationResult.anchors.forEach((anchor, key) => anchorRegistry.set(key, anchor));
    const unresolvedArrows = drawArrows(svg, molData.arrows, anchorRegistry);
    const availableAtomRefs = Array.from(refs.keys());
    const availableBonds = getAvailableBonds(anchorRegistry);
    const unresolved = [
      ...annotationResult.unresolved.map((ref) => ({ type: "annotation", ref, availableAtomRefs })),
      ...layoutWarnings,
      ...(molData.parseWarnings || []),
      ...unresolvedArrows.map((ref) => ({ type: "arrow", ref, availableAtomRefs, availableBonds }))
    ];
    renderAnnotationWarning(body, unresolved, molData.title || `Molecule ${index + 1}`);
    storeCardLayout(renderContext, molData, refs);
  } catch (error) {
    card.classList.add("has-error");
    moleculeArea.innerHTML = "";
    moleculeArea.appendChild(renderError(molData.smiles, error));
  }

  return card;
}

function drawSmiles(svg, smiles, renderSettings) {
  if (!smiles) {
    throw new Error("Missing SMILES string.");
  }

  const components = smiles.split(".").map((component) => component.trim()).filter(Boolean);
  if (components.length === 0) {
    throw new Error("Missing SMILES string.");
  }

  const rendered = components.map((component) => drawComponent(component, renderSettings));
  return Promise.resolve(composeComponents(svg, rendered));
}

function drawComponent(smiles, renderSettings) {
  const renderMode = getRenderMode(renderSettings);
  const drawOptions = getDrawOptions(renderSettings);
  const cacheKey = `${renderMode}:${drawOptions.showCarbons}:${drawOptions.explicitHydrogens}:${drawOptions.compactDrawing}:${smiles}`;
  const cached = COMPONENT_CACHE.get(cacheKey);
  if (cached) {
    return cloneRenderedComponent(cached);
  }

  let tree;
  SmilesDrawer.parse(
    smiles,
    (parsedTree) => {
      tree = parsedTree;
    },
    (error) => {
      throw error;
    }
  );

  const componentSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const drawer = new SmilesDrawer.SvgDrawer(drawOptions);
  drawer.draw(tree, componentSvg, "note", false);
  if (renderMode === "expandedHydrogens") {
    stripCondensedHydrogenLabels(componentSvg);
  }
  normalizeChemicalText(componentSvg);
  normalizeSvg(componentSvg);

  const rendered = {
    svg: componentSvg,
    atoms: getDrawnAtoms(drawer),
    viewBox: readViewBox(componentSvg)
  };
  COMPONENT_CACHE.set(cacheKey, rendered);

  return cloneRenderedComponent(rendered);
}

function getRenderMode(renderSettings = {}) {
  return renderSettings.renderMode === "expandedHydrogens"
    ? "expandedHydrogens"
    : renderSettings.renderMode === "lewis"
      ? "lewis"
      : "line";
}

function getDrawOptions(renderSettings = {}) {
  const renderMode = getRenderMode(renderSettings);
  if (renderMode === "lewis" || renderMode === "expandedHydrogens") {
    return {
      ...DRAW_OPTIONS,
      showCarbons: "all",
      terminalCarbons: true,
      explicitHydrogens: true,
      compactDrawing: false
    };
  }

  return {
    ...DRAW_OPTIONS,
    showCarbons: "default",
    terminalCarbons: false,
    explicitHydrogens: true,
    compactDrawing: false
  };
}

function stripCondensedHydrogenLabels(svg) {
  svg.querySelectorAll("text.element").forEach((textElement) => {
    const tspans = Array.from(textElement.querySelectorAll("tspan"));
    const hasNonHydrogenPart = tspans.some((tspan) => !isCondensedHydrogenText(tspan.textContent));
    if (!hasNonHydrogenPart) {
      return;
    }

    tspans.forEach((tspan) => {
      if (isCondensedHydrogenText(tspan.textContent)) {
        tspan.remove();
      }
    });
  });
}

function isCondensedHydrogenText(text) {
  return /^H[₀₁₂₃₄₅₆₇₈₉]*$/.test(String(text || "").trim());
}

function drawExpandedHydrogens(svg, atoms) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "expanded-hydrogen-layer");
  group.setAttribute("aria-hidden", "true");

  atoms.forEach((atom) => {
    if (atom.element === "H") {
      return;
    }

    const hydrogenCount = Math.max(0, Number.parseInt(atom.hydrogenCount || 0, 10) || 0);
    if (hydrogenCount === 0) {
      return;
    }

    getPseudoHydrogenSlots(atom, hydrogenCount).forEach((slot) => {
      const position = getHydrogenLabelPosition(atom, slot);
      const labelGap = clamp(8 * position.scale, 5, 10);
      const radius = clamp(9 * position.scale, 6, 10);

      group.appendChild(makeSvgElement("line", {
        class: "expanded-hydrogen-bond",
        x1: round(atom.x + position.ux * radius),
        y1: round(atom.y + position.uy * radius),
        x2: round(position.x - position.ux * labelGap),
        y2: round(position.y - position.uy * labelGap)
      }));

      const label = makeSvgElement("text", {
        class: "expanded-hydrogen-label",
        x: round(position.x),
        y: round(position.y),
        "text-anchor": "middle",
        "dominant-baseline": "middle"
      });
      label.textContent = "H";
      group.appendChild(label);
    });
  });

  if (group.childNodes.length > 0) {
    svg.appendChild(group);
  }
}

function getHydrogenLabelPosition(atom, slot) {
  const scale = Number.isFinite(atom.annotationScale) ? atom.annotationScale : 1;
  const length = clamp(34 * scale, 24, 42);
  const slotLength = Math.hypot(slot.dx, slot.dy) || 1;
  const ux = slot.dx / slotLength;
  const uy = slot.dy / slotLength;
  return {
    x: atom.x + ux * length,
    y: atom.y + uy * length,
    ux,
    uy,
    scale
  };
}

function applyRequestedLayout(svg, refs, molData, renderContext) {
  const warnings = [];
  const explicitTargets = getManualLayoutTargets(molData.layout, refs);
  let targetPoints = explicitTargets.points;

  explicitTargets.invalidRefs.forEach((ref) => {
    warnings.push({
      type: "layout",
      ref,
      availableAtomRefs: Array.from(refs.keys())
    });
  });

  if (targetPoints.length === 0 && molData.layout_from) {
    const sourceLayout = renderContext.layoutsByTitle?.get(molData.layout_from);
    if (!sourceLayout) {
      warnings.push({ type: "layout_from", ref: molData.layout_from });
    } else {
      targetPoints = Array.from(refs.entries())
        .filter(([atomRef]) => sourceLayout.has(atomRef))
        .map(([atomRef, atom]) => ({
          ref: atomRef,
          source: { x: atom.x, y: atom.y },
          target: sourceLayout.get(atomRef)
        }));

      if (targetPoints.length === 0) {
        warnings.push({
          type: "layout_from_incompatible",
          ref: molData.layout_from,
          availableAtomRefs: Array.from(refs.keys()),
          sourceAtomRefs: Array.from(sourceLayout.keys())
        });
      }
    }
  }

  if (targetPoints.length === 0) {
    return warnings;
  }

  const transform = fitTransform(targetPoints);
  if (!transform) {
    return warnings;
  }

  const structureLayer = svg.querySelector(".molecule-structure-layer");
  if (structureLayer) {
    structureLayer.setAttribute("transform", matrixToSvg(transform));
  }

  refs.forEach((atom) => {
    const point = applyTransform(transform, atom);
    atom.x = point.x;
    atom.y = point.y;
  });

  return warnings;
}

function getManualLayoutTargets(layout = {}, refs) {
  const entries = Object.entries(layout || {});
  const invalidRefs = entries
    .filter(([atomRef]) => !refs.has(atomRef))
    .map(([atomRef]) => atomRef);
  const validEntries = entries.filter(([atomRef]) => refs.has(atomRef));

  if (validEntries.length === 0) {
    return { points: [], invalidRefs };
  }

  const xs = validEntries.map(([, point]) => point[0]);
  const ys = validEntries.map(([, point]) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const area = { x: 112, y: 70, width: 296, height: 160 };

  const points = validEntries.map(([atomRef, point]) => {
    const atom = refs.get(atomRef);
    return {
      ref: atomRef,
      source: { x: atom.x, y: atom.y },
      target: {
        x: rangeX ? area.x + ((point[0] - minX) / rangeX) * area.width : area.x + area.width / 2,
        y: rangeY ? area.y + ((point[1] - minY) / rangeY) * area.height : area.y + area.height / 2
      }
    };
  });

  return { points, invalidRefs };
}

function fitTransform(points) {
  if (points.length === 1) {
    const source = points[0].source;
    const target = points[0].target;
    return { a: 1, b: 0, c: 0, d: 1, e: target.x - source.x, f: target.y - source.y };
  }

  if (points.length === 2) {
    return fitSimilarityTransform(points);
  }

  return fitAffineTransform(points);
}

function fitSimilarityTransform(points) {
  const sourceCenter = centerOf(points.map((point) => point.source));
  const targetCenter = centerOf(points.map((point) => point.target));
  const sourceVector = {
    x: points[1].source.x - points[0].source.x,
    y: points[1].source.y - points[0].source.y
  };
  const targetVector = {
    x: points[1].target.x - points[0].target.x,
    y: points[1].target.y - points[0].target.y
  };
  const sourceLength = Math.hypot(sourceVector.x, sourceVector.y) || 1;
  const targetLength = Math.hypot(targetVector.x, targetVector.y) || 1;
  const scale = targetLength / sourceLength;
  const cos = (sourceVector.x * targetVector.x + sourceVector.y * targetVector.y) / (sourceLength * targetLength);
  const sin = (sourceVector.x * targetVector.y - sourceVector.y * targetVector.x) / (sourceLength * targetLength);
  const a = scale * cos;
  const b = scale * sin;
  const c = -scale * sin;
  const d = scale * cos;

  return {
    a,
    b,
    c,
    d,
    e: targetCenter.x - (a * sourceCenter.x + c * sourceCenter.y),
    f: targetCenter.y - (b * sourceCenter.x + d * sourceCenter.y)
  };
}

function fitAffineTransform(points) {
  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  const targetX = [0, 0, 0];
  const targetY = [0, 0, 0];

  points.forEach((point) => {
    const row = [point.source.x, point.source.y, 1];
    for (let i = 0; i < 3; i += 1) {
      targetX[i] += row[i] * point.target.x;
      targetY[i] += row[i] * point.target.y;
      for (let j = 0; j < 3; j += 1) {
        normal[i][j] += row[i] * row[j];
      }
    }
  });

  const xCoefficients = solve3x3(normal, targetX);
  const yCoefficients = solve3x3(normal, targetY);
  if (!xCoefficients || !yCoefficients) {
    return fitSimilarityTransform(points.slice(0, 2));
  }

  return {
    a: xCoefficients[0],
    c: xCoefficients[1],
    e: xCoefficients[2],
    b: yCoefficients[0],
    d: yCoefficients[1],
    f: yCoefficients[2]
  };
}

function solve3x3(matrix, vector) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
        pivot = row;
      }
    }

    if (Math.abs(rows[pivot][column]) < 1e-6) {
      return null;
    }

    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let col = column; col < 4; col += 1) {
      rows[column][col] /= divisor;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = rows[row][column];
      for (let col = column; col < 4; col += 1) {
        rows[row][col] -= factor * rows[column][col];
      }
    }
  }

  return rows.map((row) => row[3]);
}

function centerOf(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function applyTransform(transform, point) {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f
  };
}

function matrixToSvg(transform) {
  return `matrix(${round(transform.a)} ${round(transform.b)} ${round(transform.c)} ${round(transform.d)} ${round(transform.e)} ${round(transform.f)})`;
}

function storeCardLayout(renderContext, molData, refs) {
  if (!renderContext.layoutsByTitle || !molData.title) {
    return;
  }

  renderContext.layoutsByTitle.set(
    molData.title,
    new Map(Array.from(refs.entries()).map(([atomRef, atom]) => [atomRef, { x: atom.x, y: atom.y }]))
  );
}

function drawAtomRefLabels(svg, refs) {
  const group = makeSvgElement("g", {
    class: "atom-label-layer",
    "aria-hidden": "true"
  });

  refs.forEach((atom, atomRef) => {
    const scale = Number.isFinite(atom.annotationScale) ? atom.annotationScale : 1;
    const label = makeSvgElement("text", {
      class: "atom-ref-label",
      x: round(atom.x + clamp(12 * scale, 8, 14)),
      y: round(atom.y - clamp(12 * scale, 8, 14)),
      "text-anchor": "start",
      "dominant-baseline": "middle"
    });
    label.textContent = atomRef;
    group.appendChild(label);
  });

  svg.appendChild(group);
}

function composeComponents(svg, components) {
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${CARD_VIEWBOX.width} ${CARD_VIEWBOX.height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("xmlns", SVG_NS);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.width = "";
  svg.style.height = "";

  const layout = getComponentLayout(components);
  const structureLayer = document.createElementNS(SVG_NS, "g");
  structureLayer.setAttribute("class", "molecule-structure-layer");
  const atoms = [];

  components.forEach((component, index) => {
    const item = layout.items[index];
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("transform", `translate(${item.tx} ${item.ty}) scale(${layout.scale})`);

    Array.from(component.svg.childNodes).forEach((child) => {
      group.appendChild(child.cloneNode(true));
    });
    namespaceSvgIds(group, `mol-${svgInstanceId++}-${index}`);
    structureLayer.appendChild(group);

    component.atoms.forEach((atom) => {
      atoms.push({
        ...atom,
        x: item.tx + atom.x * layout.scale,
        y: item.ty + atom.y * layout.scale,
        annotationScale: layout.scale,
        neighbors: []
      });
    });
  });
  svg.appendChild(structureLayer);

  const atomByComponentAndIndex = new Map();
  let cursor = 0;
  components.forEach((component, componentIndex) => {
    component.atoms.forEach((atom, atomIndex) => {
      atomByComponentAndIndex.set(`${componentIndex}:${atom.index}`, atoms[cursor + atomIndex]);
    });
    cursor += component.atoms.length;
  });

  cursor = 0;
  components.forEach((component, componentIndex) => {
    component.atoms.forEach((atom, atomIndex) => {
      atoms[cursor + atomIndex].neighbors = (atom.neighborIds || [])
        .map((neighborId) => atomByComponentAndIndex.get(`${componentIndex}:${neighborId}`))
        .filter(Boolean);
    });
    cursor += component.atoms.length;
  });

  return atoms;
}

function getDrawnAtoms(drawer) {
  const vertices = drawer?.preprocessor?.graph?.vertices || [];

  return vertices
    .map((vertex, index) => {
      const atom = vertex.value?.atom || vertex.value;
      const element = normalizeElement(atom?.element || atom?.atomicSymbol || atom?.label);
      const position = vertex.position || vertex.value?.position || atom?.position;

      if (!element || !position) {
        return null;
      }

      return {
        index: vertex.id ?? index,
        element,
        x: Number(position.x),
        y: Number(position.y),
        intrinsicCharge: normalizeNumericCharge(atom?.bracket?.charge),
        hydrogenCount: getHydrogenCount(atom),
        neighborIds: vertex.neighbours || []
      };
    })
    .filter((atom) => atom && Number.isFinite(atom.x) && Number.isFinite(atom.y));
}

function applyAnnotations(svg, refs, molData) {
  const annotationRefs = new Set([...Object.keys(molData.lonepairs || {}), ...Object.keys(molData.charges || {})]);
  const unresolved = [];
  const anchors = new Map();
  annotationRefs.forEach((atomRef) => {
    if (!atomRefLooksValid(atomRef)) {
      unresolved.push(atomRef);
      return;
    }
    const atom = refs.get(atomRef);
    if (atom) {
      const manualCharge = molData.charges?.[atomRef];
      const charge = chargeMatchesIntrinsic(manualCharge, atom.intrinsicCharge) ? "" : manualCharge;
      const atomAnchors = drawAtomAnnotations(svg, atomRef, atom, {
        lonePairs: molData.lonepairs?.[atomRef] || 0,
        charge
      });
      atomAnchors.forEach((anchor, key) => anchors.set(key, anchor));
    } else {
      unresolved.push(atomRef);
    }
  });

  return { unresolved, anchors };
}

function normalizeSvg(svg) {
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.width = "";
  svg.style.height = "";
}

function normalizeChemicalText(svg) {
  svg.querySelectorAll("tspan").forEach((tspan) => {
    const parts = splitChemicalText(tspan.textContent || "");
    if (parts.length === 1 && parts[0].kind === "normal") {
      return;
    }

    const parent = tspan.parentNode;
    parts.forEach((part, index) => {
      const replacement = document.createElementNS(SVG_NS, "tspan");
      copyAttributes(tspan, replacement);
      replacement.textContent = part.text;

      if (index > 0) {
        replacement.removeAttribute("x");
        replacement.removeAttribute("y");
      }

      if (part.kind === "sub") {
        replacement.setAttribute("baseline-shift", "-0.32em");
        replacement.setAttribute("font-size", "68%");
      } else if (part.kind === "sup") {
        replacement.setAttribute("baseline-shift", "0.48em");
        replacement.setAttribute("font-size", "68%");
      }

      parent.insertBefore(replacement, tspan);
    });
    parent.removeChild(tspan);
  });
}

function cloneRenderedComponent(component) {
  return {
    svg: component.svg.cloneNode(true),
    atoms: component.atoms.map((atom) => ({
      ...atom,
      neighborIds: [...(atom.neighborIds || [])]
    })),
    viewBox: { ...component.viewBox }
  };
}

function namespaceSvgIds(root, prefix) {
  const idMap = new Map();
  root.querySelectorAll("[id]").forEach((element) => {
    const currentId = element.id;
    const nextId = `${prefix}-${currentId}`;
    idMap.set(currentId, nextId);
    element.id = nextId;
  });

  if (idMap.size === 0) {
    return;
  }

  root.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      let value = attr.value;
      idMap.forEach((nextId, currentId) => {
        value = value
          .replaceAll(`url(#${currentId})`, `url(#${nextId})`)
          .replaceAll(`#${currentId}`, `#${nextId}`);
      });
      if (value !== attr.value) {
        element.setAttribute(attr.name, value);
      }
    });
  });
}

function splitChemicalText(text) {
  const segments = [];
  let current = { kind: null, text: "" };

  Array.from(text).forEach((char) => {
    const mapped = mapScriptChar(char);
    const kind = mapped.kind || "normal";
    if (current.kind !== kind) {
      if (current.text) {
        segments.push(current);
      }
      current = { kind, text: "" };
    }
    current.text += mapped.text;
  });

  if (current.text) {
    segments.push(current);
  }

  return segments;
}

function mapScriptChar(char) {
  const subscripts = {
    "₀": "0",
    "₁": "1",
    "₂": "2",
    "₃": "3",
    "₄": "4",
    "₅": "5",
    "₆": "6",
    "₇": "7",
    "₈": "8",
    "₉": "9"
  };
  const superscripts = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁺": "+",
    "⁻": "-"
  };

  if (subscripts[char]) {
    return { kind: "sub", text: subscripts[char] };
  }
  if (superscripts[char]) {
    return { kind: "sup", text: superscripts[char] };
  }
  return { kind: "normal", text: char };
}

function copyAttributes(source, target) {
  Array.from(source.attributes).forEach((attr) => {
    target.setAttribute(attr.name, attr.value);
  });
}

function renderAnnotationWarning(body, unresolved, title = "Molecule") {
  if (unresolved.length === 0) {
    return;
  }

  const warning = body.querySelector(".annotation-warning");
  const warningItems = unresolved.map(expandWarning);
  const copyText = [
    `Warnings for ${title}:`,
    ...warningItems.map((item) => `- ${item}`)
  ].join("\n");

  warning.hidden = false;
  warning.dataset.warningText = copyText;
  warning.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "warning-heading";

  const label = document.createElement("strong");
  label.textContent = `Warnings (${warningItems.length})`;

  const copy = document.createElement("button");
  copy.type = "button";
  copy.dataset.action = "copy-warnings";
  copy.textContent = "Copy warnings";

  heading.append(label, copy);
  warning.appendChild(heading);

  const list = document.createElement("ul");
  warningItems.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.appendChild(entry);
  });
  warning.appendChild(list);
}

function expandWarning(rawWarning) {
  if (rawWarning && typeof rawWarning === "object") {
    if (rawWarning.type === "annotation") {
      return `Invalid atom reference "${rawWarning.ref}". Available atom refs in this molecule: ${formatAvailableRefs(rawWarning.availableAtomRefs)}. Atom refs are counted by element, so C1 is the first carbon and N2 is the second nitrogen.`;
    }

    if (rawWarning.type === "arrow") {
      return `Could not resolve "${rawWarning.ref}". Available atoms: ${formatAvailableRefs(rawWarning.availableAtomRefs)}. Available bonds: ${formatAvailableRefs(rawWarning.availableBonds)}.`;
    }

    if (rawWarning.type === "layout") {
      return `Invalid layout atom reference "${rawWarning.ref}". Available atom refs in this molecule: ${formatAvailableRefs(rawWarning.availableAtomRefs)}.`;
    }

    if (rawWarning.type === "layout_from") {
      return `Could not apply layout_from "${rawWarning.ref}" because no earlier card has that exact title.`;
    }

    if (rawWarning.type === "layout_from_incompatible") {
      return `Could not apply layout_from "${rawWarning.ref}" because no compatible atom refs were found. Current atoms: ${formatAvailableRefs(rawWarning.availableAtomRefs)}. Source atoms: ${formatAvailableRefs(rawWarning.sourceAtomRefs)}.`;
    }
  }

  const warning = String(rawWarning || "").trim();

  if (warning.startsWith("annotation ")) {
    const ref = warning.replace(/^annotation\s+/, "");
    return `Invalid atom reference "${ref}". Check that the atom reference exists by element order, such as O1 for first oxygen or C2 for second carbon.`;
  }

  if (warning.startsWith("arrow ")) {
    const ref = warning.replace(/^arrow\s+/, "");
    return `Could not draw arrow "${ref}". Endpoints must resolve to atoms, drawn lone pairs like O1.lp1, or real rendered bonds like C1-O1. Implicit hydrogen targets like N1-H1 are approximate and only work when that atom has implicit hydrogens.`;
  }

  if (warning.startsWith("Invalid arrow:")) {
    const ref = warning.replace(/^Invalid arrow:\s*/, "");
    return `Invalid arrow syntax "${ref}". Use one arrow per line in the form FROM -> TO, optionally followed by curve: left or curve: right.`;
  }

  return warning;
}

function formatAvailableRefs(refs = []) {
  return refs.length ? refs.join(", ") : "none";
}

function getAvailableBonds(anchorRegistry) {
  const seen = new Set();
  const bonds = [];
  anchorRegistry.forEach((anchor) => {
    if (anchor?.type !== "bond" || !anchor.key || seen.has(anchor.key)) {
      return;
    }
    seen.add(anchor.key);
    bonds.push(anchor.key);
  });
  return bonds.sort(compareRefs);
}

function compareRefs(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function buildAnchorRegistry(refs) {
  const registry = new Map();
  const atomRefByAtom = new Map();

  refs.forEach((atom, atomRef) => {
    const anchor = {
      type: "atom",
      key: atomRef,
      x: atom.x,
      y: atom.y,
      atom
    };
    registry.set(atomRef, anchor);
    atomRefByAtom.set(atom, atomRef);
  });

  refs.forEach((atom, atomRef) => {
    (atom.neighbors || []).forEach((neighbor) => {
      const neighborRef = atomRefByAtom.get(neighbor);
      if (!neighborRef) {
        return;
      }

      addBondAnchor(registry, atomRef, neighborRef, registry.get(atomRef), registry.get(neighborRef));
    });
  });

  addPseudoHydrogenAnchors(registry, refs);
  return registry;
}

function addBondAnchor(registry, aRef, bRef, a, b) {
  const directKey = `${aRef}-${bRef}`;
  const reverseKey = `${bRef}-${aRef}`;
  if (registry.has(directKey) || registry.has(reverseKey)) {
    return;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const anchor = {
    type: "bond",
    key: directKey,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    angle: Math.atan2(dy, dx),
    normal: { x: -dy / length, y: dx / length },
    atoms: [aRef, bRef]
  };
  registry.set(directKey, anchor);
  registry.set(reverseKey, anchor);
}

function addPseudoHydrogenAnchors(registry, refs) {
  let globalHydrogenIndex = 1;

  refs.forEach((atom, atomRef) => {
    const hydrogenCount = Math.max(0, Number.parseInt(atom.hydrogenCount || 0, 10) || 0);
    const slots = getPseudoHydrogenSlots(atom, hydrogenCount);

    slots.forEach((slot, index) => {
      const localRef = `H${index + 1}`;
      const globalRef = `H${globalHydrogenIndex++}`;
      const position = getHydrogenLabelPosition(atom, slot);
      const anchor = {
        type: "pseudoHydrogen",
        key: `${atomRef}.${localRef}`,
        x: position.x,
        y: position.y,
        parent: atomRef
      };

      registry.set(`${atomRef}.${localRef}`, anchor);
      registry.set(`${atomRef}-${localRef}`, makePseudoBondAnchor(atomRef, localRef, registry.get(atomRef), anchor));
      registry.set(`${localRef}-${atomRef}`, registry.get(`${atomRef}-${localRef}`));

      if (!registry.has(globalRef)) {
        registry.set(globalRef, anchor);
      }
    });
  });
}

function makePseudoBondAnchor(atomRef, hydrogenRef, atomAnchor, hydrogenAnchor) {
  const dx = hydrogenAnchor.x - atomAnchor.x;
  const dy = hydrogenAnchor.y - atomAnchor.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    type: "bond",
    key: `${atomRef}-${hydrogenRef}`,
    x: (atomAnchor.x + hydrogenAnchor.x) / 2,
    y: (atomAnchor.y + hydrogenAnchor.y) / 2,
    angle: Math.atan2(dy, dx),
    normal: { x: -dy / length, y: dx / length },
    atoms: [atomRef, hydrogenRef]
  };
}

function getPseudoHydrogenSlots(atom, count) {
  if (count <= 0) {
    return [];
  }

  const candidates = [
    { dx: -28, dy: -16, angle: Math.atan2(-16, -28) },
    { dx: 28, dy: -16, angle: Math.atan2(-16, 28) },
    { dx: 30, dy: 14, angle: Math.atan2(14, 30) },
    { dx: -30, dy: 14, angle: Math.atan2(14, -30) },
    { dx: 0, dy: -32, angle: Math.atan2(-32, 0) },
    { dx: 0, dy: 32, angle: Math.atan2(32, 0) }
  ];
  const neighborAngles = (atom.neighbors || []).map((neighbor) => Math.atan2(neighbor.y - atom.y, neighbor.x - atom.x));

  return candidates
    .map((slot) => ({
      ...slot,
      score: neighborAngles.length
        ? Math.min(...neighborAngles.map((angle) => angularDistance(slot.angle, angle)))
        : Math.PI
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

function getHydrogenCount(atom) {
  try {
    return Number(atom?.countImplicitHydrogens?.() || 0);
  } catch {
    return 0;
  }
}

function angularDistance(a, b) {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

function getComponentLayout(components) {
  const safeBoxes = components.map((component) => ({
    ...component.viewBox,
    width: Math.max(component.viewBox.width, 42),
    height: Math.max(component.viewBox.height, 42)
  }));
  const area = { x: 42, y: 40, width: 436, height: 184 };
  const gap = components.length > 1 ? 92 : 0;
  const totalWidth = safeBoxes.reduce((sum, box) => sum + box.width, 0) + gap * (safeBoxes.length - 1);
  const maxHeight = Math.max(...safeBoxes.map((box) => box.height));
  const scale = Math.min(area.width / totalWidth, area.height / maxHeight, components.length === 1 ? 1.9 : 1.45);
  const usedWidth = totalWidth * scale;
  const usedHeight = maxHeight * scale;
  let currentX = area.x + (area.width - usedWidth) / 2;
  const y = area.y + (area.height - usedHeight) / 2;

  return {
    scale,
    items: safeBoxes.map((box) => {
      const item = {
        tx: currentX - box.x * scale,
        ty: y - box.y * scale
      };
      currentX += box.width * scale + gap * scale;
      return item;
    })
  };
}

function readViewBox(svg) {
  const viewBox = svg.getAttribute("viewBox");
  if (!viewBox) {
    return { x: 0, y: 0, width: DRAW_OPTIONS.width, height: DRAW_OPTIONS.height };
  }

  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  return { x, y, width, height };
}

function getDisplaySmiles(molData) {
  const smiles = String(molData.smiles || "");
  const elementCounts = new Map();
  let output = "";

  for (let index = 0; index < smiles.length; index += 1) {
    const char = smiles[index];

    if (char === "[") {
      const end = smiles.indexOf("]", index);
      if (end === -1) {
        output += char;
        continue;
      }

      const content = smiles.slice(index + 1, end);
      const element = getBracketElement(content);
      const atomRef = element ? nextAtomRef(elementCounts, element) : "";
      const shouldStripCharge = atomRef && molData.charges?.[atomRef] && Number(molData.lonepairs?.[atomRef] || 0) > 0;
      output += `[${shouldStripCharge ? stripBracketCharge(content) : content}]`;
      index = end;
      continue;
    }

    const organicElement = getOrganicElement(smiles, index);
    if (organicElement) {
      nextAtomRef(elementCounts, organicElement.element);
      output += organicElement.raw;
      index += organicElement.raw.length - 1;
      continue;
    }

    output += char;
  }

  return output;
}

function getBracketElement(content) {
  const match = content.match(/^\d*([A-Z][a-z]?|[cnopsb])/);
  return match ? normalizeElement(match[1]) : "";
}

function getOrganicElement(smiles, index) {
  const two = smiles.slice(index, index + 2);
  if (two === "Cl" || two === "Br") {
    return { raw: two, element: two };
  }

  const one = smiles[index];
  if ("BCNOPSFIconpsb".includes(one)) {
    return { raw: one, element: normalizeElement(one) };
  }

  return null;
}

function nextAtomRef(elementCounts, element) {
  const nextCount = (elementCounts.get(element) || 0) + 1;
  elementCounts.set(element, nextCount);
  return `${element}${nextCount}`;
}

function stripBracketCharge(content) {
  return content.replace(/([+-]{1,3}|[+-]\d+|\d+[+-])(?=(:\d+)?$)/, "");
}

function normalizeNumericCharge(charge) {
  if (!charge) {
    return "";
  }
  if (charge === 1) {
    return "+";
  }
  if (charge === -1) {
    return "-";
  }
  return charge > 0 ? `${charge}+` : `${Math.abs(charge)}-`;
}

function chargeMatchesIntrinsic(charge, intrinsicCharge) {
  if (!charge || !intrinsicCharge) {
    return false;
  }

  const normalized = String(charge).trim().replace(/^\+1$/, "+").replace(/^-1$/, "-");
  return normalized === intrinsicCharge;
}

function normalizeElement(element) {
  if (!element) {
    return "";
  }

  const raw = String(element);
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderError(smiles, error) {
  const wrapper = document.createElement("div");
  wrapper.className = "render-error";
  const message = typeof error === "string" ? error : error?.message || "Unable to render molecule.";
  wrapper.innerHTML = `
    <strong>SMILES render failed</strong>
    <span>${escapeHtml(smiles || "No SMILES provided")}</span>
    <small>${escapeHtml(message)}</small>
  `;
  return wrapper;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
