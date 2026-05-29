# Text to Chem

Paste LLM-generated SMILES blocks and render organic chemistry note cards with lone pairs, formal charges, and captions.

Text to Chem is a small browser-based renderer for structured chemistry note packages. It runs client-side in the browser, keeps the source text local, and focuses on rendering study cards. It is not a molecule editor or chemistry validator.

## Run Locally

This project uses npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use `Import package` to paste a molecule-card package; after import, the source closes and the app shows rendered chemistry only.

## Build Locally

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.

Run the test/build verification pass:

```bash
npm run verify
```

## GitHub Pages Deployment

The app is configured for a GitHub Pages project site at:

```text
https://USERNAME.github.io/text-to-chem/
```

Vite uses this base path by default in [vite.config.js](./vite.config.js):

```js
base: process.env.VITE_BASE_PATH || "/text-to-chem/"
```

If your repository name is different, change `/text-to-chem/` to `/<repo-name>/`, or build with an override:

```bash
VITE_BASE_PATH="/your-repo-name/" npm run build
```

For a custom domain or root deployment, use:

```bash
VITE_BASE_PATH="/" npm run build
```

The GitHub Actions workflow in [.github/workflows/deploy.yml](./.github/workflows/deploy.yml) builds on pushes to `main` and deploys `dist/` with the official GitHub Pages actions.

After pushing to GitHub, set the repository Pages source to `GitHub Actions` in repository settings.

## PWA

The app includes a small web app manifest, SVG icon, and minimal service worker. Browsers that support installable PWAs can install it from the deployed or local preview URL. The service worker caches the app shell and same-origin assets for basic offline use after the app has loaded once.

## Analytics

Usage tracking is optional and uses GoatCounter when `VITE_GOATCOUNTER_ENDPOINT` is configured.

The app tracks coarse product statistics only:

- page views through GoatCounter's normal script
- import opened
- import success/failure
- rendered card-count buckets
- warning/error-count buckets
- profile changes
- SVG/PNG export clicks

It does not send pasted molecule-card text, SMILES strings, captions, atom labels, arrows, or rendered images.

For local setup, copy `.env.example` to `.env.local` and set:

```bash
VITE_GOATCOUNTER_ENDPOINT=https://YOURCODE.goatcounter.com/count
```

For GitHub Pages, create a repository variable named `GOATCOUNTER_ENDPOINT` with the same value.

## Input Syntax

```text
::mol
title: Starting structure
smiles: O=C1[C-]CCCC1
lonepairs:
  O1: 2
  C2: 1
charges:
  C2: -
arrows:
  C2.lp1 -> C1-C2 curve: left
  C1-O1 -> O1 curve: right
caption: The carbon lone pair forms the new C=C pi bond to the carbonyl carbon, and the C=O pi electrons move onto oxygen.
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

Enable `Show SVG/PNG export buttons` in Profile to add per-card export controls:

- `SVG` for a clean molecule SVG download.
- `PNG` for a high-resolution molecule PNG download.

Exports include the molecule drawing and manual annotations on an off-white background. They do not include the app UI, title, or caption.

## Limitations

- This is a renderer, not a chemistry editor.
- This is not a chemistry validator.
- Lone pairs and charges are manual annotations.
- Curved arrows are manual geometry annotations.
- Atom references are resolved by element order only.
- Lone-pair placement is simple radial placement, optimized for readability rather than strict chemical geometry.
- If an atom reference cannot be resolved, the card shows an unresolved annotation warning.
- Arrow endpoints must reference atoms, lone pairs, or rendered bonds that can be resolved from the card. Failed arrow warnings list available atoms and bonds.
- `layout` and `layout_from` are lightweight orientation aids, not a full coordinate editor.
- Expanded implicit hydrogens are display overlays based on SmilesDrawer hydrogen counts.

## License

Copyright (c) 2026 Bridger Brundy. All rights reserved. See [LICENSE](./LICENSE).

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
