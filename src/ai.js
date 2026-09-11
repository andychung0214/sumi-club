import { legalMoves, rank, classify } from "./rules.js";
export const LEVELS = ["入門", "標準", "進階", "高手"];
export function chooseMove(state, seat, level = 1, random = Math.random) {
  const moves = legalMoves(state, seat),
    plays = moves.filter((m) => m.length);
  if (!plays.length) return [];
  if (level === 0) return plays[Math.floor(random() * plays.length)];
  const hand = state.hands ? state.hands[seat] : state.hand;
  const counts = state.counts || state.hands.map((h) => h.length);
  const urgent = counts.some((n, i) => i !== seat && n <= 2);
  function score(m) {
    let value = m.length * 100 - m.reduce((a, c) => a + c, 0) / m.length;
    if (level >= 2) {
      const remaining = hand.filter((c) => !m.includes(c));
      const groups = new Map();
      remaining.forEach((c) =>
        groups.set(rank(c), (groups.get(rank(c)) || 0) + 1),
      );
      value += [...groups.values()].reduce(
        (a, n) => a + (n > 1 ? n * 9 : 0),
        0,
      );
      value -= m.filter((c) => rank(c) === 12).length * 15;
    }
    if (level >= 3) {
      const remaining = hand.filter((c) => !m.includes(c));
      const ranks = new Set(remaining.map(rank));
      for (let r = 0; r < 8; r++)
        if ([0, 1, 2, 3, 4].every((d) => ranks.has(r + d))) value += 22;
      if (urgent && state.last) value += Math.max(...m) * 2;
    }
    if (m.length === hand.length) value += 10000;
    return value;
  }
  return plays.sort(
    (a, b) =>
      score(b) - score(a) || classify(a).key.at(-1) - classify(b).key.at(-1),
  )[0];
}
