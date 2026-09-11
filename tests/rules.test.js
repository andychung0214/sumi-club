import test from "node:test";
import assert from "node:assert/strict";
import {
  deck,
  classify,
  beats,
  newGame,
  act,
  legalMoves,
  snapshot,
} from "../src/rules.js";
import { chooseMove } from "../src/ai.js";
const c = (rank, suit = 0) => (rank - 3) * 4 + suit;
test("52 unique cards", () => assert.equal(new Set(deck()).size, 52));
test("single and pair ordering includes suits and 2", () => {
  assert.ok(beats([51], [47]));
  assert.ok(beats([c(6, 1), c(6, 3)], [c(6, 0), c(6, 2)]));
  assert.equal(classify([0, 0]), null);
  assert.equal(classify([0, 4]), null);
});
test("all five-card types and ordering", () => {
  const hands = [
    [0, 5, 10, 15, 16],
    [0, 8, 20, 32, 44],
    [0, 1, 2, 4, 5],
    [0, 1, 2, 3, 8],
    [0, 4, 8, 12, 16],
  ];
  assert.deepEqual(
    hands.map((x) => classify(x).type),
    ["順子", "同花", "葫蘆", "鐵支", "同花順"],
  );
  hands.slice(1).forEach((x, i) => assert.ok(beats(x, hands[i])));
  assert.equal(classify([40, 45, 50, 3, 4]), null);
  assert.equal(beats(hands[4], [51]), false);
});
test("opening, turn ownership, invalid action immutability and passing reset", () => {
  let g = newGame(["甲", "乙", "丙", "丁"], () => 0.4);
  const s = g.turn;
  const before = JSON.stringify(g);
  assert.throws(() => act(g, s, []));
  assert.throws(() => act(g, (s + 1) % 4, [g.opening]));
  assert.throws(() => act(g, s, [g.opening, g.opening]));
  assert.equal(JSON.stringify(g), before);
  g = act(g, s, [g.opening]);
  for (let i = 0; i < 3; i++) g = act(g, g.turn, []);
  assert.equal(g.turn, s);
  assert.equal(g.last, null);
  assert.equal(g.first, false);
});
test("2 and 3 players: 13 cards each and dealt minimum starts", () => {
  for (const n of [2, 3]) {
    const g = newGame(Array(n).fill("玩家"));
    assert.ok(g.hands.every((h) => h.length === 13));
    assert.equal(g.opening, Math.min(...g.hands.flat()));
  }
});
test("snapshots hide opponents hands", () => {
  const g = newGame(["甲", "乙"]);
  const s = snapshot(g, 0);
  assert.deepEqual(s.hand, g.hands[0]);
  assert.equal("hands" in s, false);
  assert.deepEqual(s.counts, [13, 13]);
});
test("all four CPU levels finish legal matches with 2–4 players", () => {
  for (let level = 0; level < 4; level++)
    for (let n = 2; n <= 4; n++) {
      let g = newGame(Array.from({ length: n }, (_, i) => String(i)));
      let steps = 0;
      while (g.winner === null && steps++ < 700) {
        const m = chooseMove(g, g.turn, level);
        assert.ok(
          legalMoves(g, g.turn).some(
            (x) => JSON.stringify(x) === JSON.stringify(m),
          ),
        );
        g = act(g, g.turn, m);
      }
      assert.notEqual(g.winner, null);
      assert.equal(g.hands[g.winner].length, 0);
    }
});
