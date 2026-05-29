# Text to Chem

A small local-only chemistry note renderer for organic chemistry studying. Import `::mol` blocks with valid SMILES plus manual annotations, and the app renders molecule cards with lone-pair dots, formal charges, arrows, and captions.

## Run

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

Use `Import` to paste new LLM output. Check `Open in new tab` to keep the current rendered set and create another in-app tab; uncheck it to overwrite the active tab. Use `Edit source` when you want to reopen the current tab's source text. The source box stays hidden while you study or export cards.

You can also build static files:

```bash
npm run build
npm run preview
```

Run the test/build verification pass:

```bash
npm run verify
```

## Input Syntax

```text
::mol
title: Starting structure
smiles: O=C1[C-]C=CCC1
lonepairs:
  O1: 2
  C2: 1
charges:
  C2: -
arrows:
  C2.lp1 -> C1-O1
  C1-O1 -> O1
caption: The negative charge is on the alpha carbon next to the carbonyl.
```

Atom references use element order in the rendered molecule:

- `O1` means the first oxygen atom.
- `C2` means the second carbon atom.
- `N1` means the first nitrogen atom.
- `Cl1` means the first chlorine atom.

Dot-separated SMILES fragments such as `C[NH3+].[Cl-]` are rendered as separated components inside one card. Manual annotations still use element order across the whole card.

For OWL-style screenshot mapping, optional aliases can stand in for atom refs:

```text
aliases:
  topLeftC: C4
  bottomLeftC: C5
  oxygen: O1
charges:
  topLeftC: +
arrows:
  topLeftC-bottomLeftC -> bottomLeftC-oxygen curve: right
```

Aliases are resolved before rendering charges, lone pairs, layout, and arrows.

Set `show_atom_labels: true` to render small `C1`, `C2`, `O1` labels next to atoms:

```text
show_atom_labels: true
```

To keep resonance cards aligned, reuse an earlier card's rendered positions:

```text
layout_from: Starting structure
```

For rough screenshot orientation, provide simple manual coordinates. These are not editor coordinates; they are just layout hints.

```text
layout:
  C1: [0, 0]
  C2: [1, 0]
  O1: [0, 1]
```

Arrow endpoints are manual references:

- `O1.lp1` means the first lone-pair annotation on `O1`.
- `O1` means the atom anchor for `O1`.
- `C1-O1` means the rendered bond between `C1` and `O1`.
- `N1-H1` means the approximate first hydrogen attached to `N1` when hydrogens are implicit in labels such as `NH3`.

Optional curve hints are supported:

```text
arrows:
  O1.lp1 -> N1-H1 curve: left
  N1-H1 -> N1 curve: right
```

## Exports

Each rendered card has:

- `SVG` for a clean molecule SVG download.
- `PNG` for a high-resolution molecule PNG download.

Exports include the molecule drawing and manual annotations on an off-white background. They do not include the editor UI, title, or caption.

## Limitations

- This is a renderer, not a chemistry editor.
- Lone pairs and charges are manual annotations.
- Curved arrows are manual geometry annotations.
- Atom references are resolved by element order only.
- Lone-pair placement is simple radial placement, optimized for readability rather than strict chemical geometry.
- If an atom reference cannot be resolved, the card shows an unresolved annotation warning.
- Arrow endpoints must reference atoms, lone pairs, or rendered bonds that can be resolved from the card. Failed arrow warnings list available atoms and bonds.
- `layout` and `layout_from` are lightweight orientation aids, not a full coordinate editor.
- Expanded implicit hydrogens are display overlays based on SmilesDrawer hydrogen counts.

## LLM Prompts

### Card Format

```text
Format organic chemistry structures as molecule cards in this exact format. Use valid SMILES. Include lone pairs and formal charges as manual annotations, not inferred chemistry.

::mol
title: Starting structure
smiles: ...
lonepairs:
  O1: 2
  C2: 1
charges:
  C2: -
caption: One sentence explanation.

::mol
title: Resonance form
smiles: ...
lonepairs:
  O1: 3
charges:
  O1: -
caption: One sentence explanation.
```

### Arrow Add-On

```text
Add curved-arrow annotations only when electron movement needs to be shown. Keep the same molecule-card format and add an arrows section. Do not infer missing lone pairs or charges; include the needed manual annotations.

Arrow endpoint syntax:
- O1.lp1 means the first lone pair drawn on O1.
- O1 means atom O1.
- C1-O1 means the bond between C1 and O1.
- N1-H1 means the first implicit hydrogen attached to N1 when the label includes hydrogens.

Example:

arrows:
  O1.lp1 -> N1-H1 curve: left
  N1-H1 -> N1 curve: right
```
