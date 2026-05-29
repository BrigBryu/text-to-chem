import assert from "node:assert/strict";
import test from "node:test";
import { resolveArrowEndpoint } from "../src/arrows.js";

function atomAnchor(key, x, y) {
  return { type: "atom", key, x, y };
}

function bondAnchor(key, x, y) {
  return { type: "bond", key, x, y, normal: { x: 0, y: -1 } };
}

test("resolves direct atoms and registered bonds", () => {
  const registry = new Map([
    ["C1", atomAnchor("C1", 0, 0)],
    ["O1", atomAnchor("O1", 10, 0)],
    ["C1-O1", bondAnchor("C1-O1", 5, 0)]
  ]);

  assert.equal(resolveArrowEndpoint("C1", registry), registry.get("C1"));
  assert.equal(resolveArrowEndpoint("O1-C1", registry), registry.get("C1-O1"));
});

test("does not fabricate non-bond endpoints from two valid atoms", () => {
  const registry = new Map([
    ["C1", atomAnchor("C1", 0, 0)],
    ["C2", atomAnchor("C2", 10, 0)]
  ]);

  assert.equal(resolveArrowEndpoint("C1-C2", registry), null);
});

test("resolves lone-pair anchors exactly", () => {
  const registry = new Map([
    ["O1.lp1", { type: "lonePair", x: 3, y: 4 }]
  ]);

  assert.equal(resolveArrowEndpoint("O1.lp1", registry), registry.get("O1.lp1"));
});
