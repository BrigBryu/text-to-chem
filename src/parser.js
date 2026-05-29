export function parseMolBlocks(input) {
  if (!input || !input.trim()) {
    return [];
  }

  return input
    .split(/^::mol\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseBlock);
}

function parseBlock(block) {
  const mol = {
    title: "",
    smiles: "",
    lonepairs: {},
    charges: {},
    aliases: {},
    layout: {},
    layout_from: "",
    show_atom_labels: false,
    arrows: [],
    parseWarnings: [],
    caption: ""
  };

  const lines = block.split(/\r?\n/);
  let section = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const topLevelMatch = trimmed.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (topLevelMatch && !rawLine.match(/^\s{2,}/)) {
      const key = topLevelMatch[1].toLowerCase();
      const value = topLevelMatch[2].trim();
      section = null;

      if (key === "title" || key === "smiles" || key === "caption") {
        mol[key] = value;
      } else if (key === "layout_from") {
        mol.layout_from = value;
      } else if (key === "show_atom_labels") {
        mol.show_atom_labels = parseBoolean(value);
      } else if (key === "lonepairs" || key === "charges" || key === "arrows" || key === "aliases" || key === "layout") {
        section = key;
        if (value) {
          parseSectionLine(value, mol, section);
        }
      }
      continue;
    }

    if (section && rawLine.match(/^\s+/)) {
      parseSectionLine(trimmed, mol, section);
    }
  }

  resolveAliases(mol);
  return mol;
}

function parseSectionLine(line, mol, section) {
  if (section === "arrows") {
    parseArrowLine(line, mol);
  } else if (section === "aliases") {
    parseAliasLine(line, mol);
  } else if (section === "layout") {
    parseLayoutLine(line, mol);
  } else {
    parseAnnotationLine(line, mol[section], section);
  }
}

function parseAnnotationLine(line, target, section) {
  const match = line.match(/^([^:]+)\s*:\s*(.+)$/);
  if (!match) {
    return;
  }

  const [, rawRef, rawValue] = match;
  const atomRef = rawRef.trim();
  if (section === "lonepairs") {
    const count = Number.parseInt(rawValue, 10);
    if (Number.isFinite(count) && count > 0) {
      target[atomRef] = count;
    }
  } else if (section === "charges") {
    target[atomRef] = rawValue.trim();
  }
}

function parseAliasLine(line, mol) {
  const match = line.match(/^([^:]+)\s*:\s*(.+)$/);
  if (!match) {
    return;
  }

  const alias = match[1].trim();
  const atomRef = match[2].trim();
  if (alias && atomRef) {
    mol.aliases[alias] = atomRef;
  }
}

function parseLayoutLine(line, mol) {
  const match = line.match(/^([^:]+)\s*:\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*$/);
  if (!match) {
    mol.parseWarnings.push(`Invalid layout: ${line}`);
    return;
  }

  mol.layout[match[1].trim()] = [Number(match[2]), Number(match[3])];
}

function parseArrowLine(line, mol) {
  const cleanLine = line.replace(/^-\s*/, "").trim();
  const match = cleanLine.match(/^(.+?)\s*->\s*(.+?)(?:\s+(?:curve|bend)\s*:\s*(left|right))?$/i);
  if (!match) {
    mol.parseWarnings.push(`Invalid arrow: ${line}`);
    return;
  }

  mol.arrows.push({
    from: match[1].trim(),
    to: match[2].trim(),
    curve: match[3]?.toLowerCase() || "auto",
    raw: cleanLine
  });
}

function resolveAliases(mol) {
  mol.lonepairs = resolveAnnotationAliases(mol.lonepairs, mol.aliases);
  mol.charges = resolveAnnotationAliases(mol.charges, mol.aliases);
  mol.layout = resolveLayoutAliases(mol.layout, mol.aliases);
  mol.arrows = mol.arrows.map((arrow) => {
    const from = resolveEndpointAliases(arrow.from, mol.aliases);
    const to = resolveEndpointAliases(arrow.to, mol.aliases);
    return {
      ...arrow,
      from,
      to,
      raw: `${from} -> ${to}${arrow.curve && arrow.curve !== "auto" ? ` curve: ${arrow.curve}` : ""}`
    };
  });
}

function resolveAnnotationAliases(values, aliases) {
  return Object.fromEntries(
    Object.entries(values).map(([ref, value]) => [resolveAtomAlias(ref, aliases), value])
  );
}

function resolveLayoutAliases(layout, aliases) {
  return Object.fromEntries(
    Object.entries(layout).map(([ref, value]) => [resolveAtomAlias(ref, aliases), value])
  );
}

function resolveEndpointAliases(endpoint, aliases) {
  const ref = String(endpoint || "").trim();
  if (!ref) {
    return ref;
  }

  const lonePairMatch = ref.match(/^(.+?)(\.lp\d+|\.charge)$/);
  if (lonePairMatch) {
    return `${resolveAtomAlias(lonePairMatch[1], aliases)}${lonePairMatch[2]}`;
  }

  const bondMatch = ref.match(/^(.+?)-(.+)$/);
  if (bondMatch) {
    return `${resolveAtomAlias(bondMatch[1], aliases)}-${resolveAtomAlias(bondMatch[2], aliases)}`;
  }

  return resolveAtomAlias(ref, aliases);
}

function resolveAtomAlias(ref, aliases) {
  let current = String(ref || "").trim();
  const seen = new Set();
  while (aliases[current] && !seen.has(current)) {
    seen.add(current);
    current = aliases[current].trim();
  }
  return current;
}

function parseBoolean(value) {
  return /^(true|yes|1|on)$/i.test(String(value || "").trim());
}
