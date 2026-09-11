import test from "node:test";
import assert from "node:assert/strict";
import { parseCode, validAction } from "../src/network.js";
test("SDP rejects malformed, oversized, wrong version and wrong role", () => {
  for (const v of [
    "garbage",
    "x".repeat(65000),
    btoa(JSON.stringify({ v: 2, type: "offer", sdp: "v=0" })),
    btoa(JSON.stringify({ v: 1, type: "answer", sdp: "v=0" })),
  ])
    assert.throws(() => parseCode(v, "offer"));
  assert.equal(
    parseCode(
      btoa(JSON.stringify({ v: 1, type: "offer", sdp: "v=0\r\n" })),
      "offer",
    ).type,
    "offer",
  );
});
test("actions reject duplicates, invalid IDs and invalid revisions", () => {
  assert.ok(validAction({ type: "action", revision: 0, cards: [] }));
  assert.ok(validAction({ type: "action", revision: 2, cards: [0, 1] }));
  for (const cards of [[52], [-1], [0, 0], ["3"], [1, 2, 3, 4, 5, 6]])
    assert.equal(validAction({ type: "action", revision: 0, cards }), false);
  assert.equal(
    validAction({ type: "action", revision: "0", cards: [] }),
    false,
  );
});
