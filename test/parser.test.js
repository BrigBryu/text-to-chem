import assert from "node:assert/strict";
import test from "node:test";
import { parseMolBlocks } from "../src/parser.js";

test("parses aliases and resolves them across annotations, layout, and arrows", () => {
  const [mol] = parseMolBlocks(`::mol
title: OWL map
smiles: CCO
show_atom_labels: true
aliases:
  leftC: C1
  oxygen: O1
layout:
  leftC: [0, 0]
  oxygen: [1, 1]
lonepairs:
  oxygen: 2
charges:
  oxygen: -
arrows:
  leftC-oxygen -> oxygen.lp1 curve: right
caption: Alias test.`);

  assert.equal(mol.show_atom_labels, true);
  assert.deepEqual(mol.lonepairs, { O1: 2 });
  assert.deepEqual(mol.charges, { O1: "-" });
  assert.deepEqual(mol.layout, { C1: [0, 0], O1: [1, 1] });
  assert.deepEqual(mol.arrows, [
    {
      from: "C1-O1",
      to: "O1.lp1",
      curve: "right",
      raw: "C1-O1 -> O1.lp1 curve: right"
    }
  ]);
});

test("parses layout_from and invalid layout warnings", () => {
  const [mol] = parseMolBlocks(`::mol
title: Resonance form
smiles: CCO
layout_from: Starting structure
layout:
  C1: [0, 0]
  bad line
caption: Reuse layout.`);

  assert.equal(mol.layout_from, "Starting structure");
  assert.deepEqual(mol.layout, { C1: [0, 0] });
  assert.deepEqual(mol.parseWarnings, ["Invalid layout: bad line"]);
});

test("keeps empty charges sections and ignores zero lone-pair annotations", () => {
  const [mol] = parseMolBlocks(`::mol
title: Neutral
smiles: CN
lonepairs:
  N1: 0
charges:
caption: Neutral methylamine.`);

  assert.deepEqual(mol.lonepairs, {});
  assert.deepEqual(mol.charges, {});
});
