export const SUITS = ["♦", "♣", "♥", "♠"];
export const RANKS = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
  "2",
];
export const rank = (id) => Math.floor(id / 4);
export const suit = (id) => id % 4;
export const label = (id) => SUITS[suit(id)] + RANKS[rank(id)];
export const deck = () => Array.from({ length: 52 }, (_, i) => i);
const compare = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
};
export function classify(input) {
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.some((x) => !Number.isInteger(x) || x < 0 || x > 51) ||
    new Set(input).size !== input.length
  )
    return null;
  const cards = [...input].sort((a, b) => a - b),
    n = cards.length,
    rs = cards.map(rank),
    ss = cards.map(suit);
  const groups = new Map();
  rs.forEach((r) => groups.set(r, (groups.get(r) || 0) + 1));
  if (n === 1) return { type: "單張", key: [cards[0]], size: n };
  if ((n === 2 || n === 3) && groups.size === 1)
    return { type: n === 2 ? "對子" : "三條", key: [cards.at(-1)], size: n };
  if (n !== 5) return null;
  const flush = new Set(ss).size === 1,
    straight = groups.size === 5 && rs[4] - rs[0] === 4 && rs[4] < 12;
  const groupRank = (count) => [...groups].find(([, v]) => v === count)?.[0];
  let type, key;
  if (straight && flush) {
    type = "同花順";
    key = [4, cards[4]];
  } else if (groupRank(4) !== undefined) {
    type = "鐵支";
    key = [3, groupRank(4)];
  } else if (groupRank(3) !== undefined && groupRank(2) !== undefined) {
    type = "葫蘆";
    key = [2, groupRank(3)];
  } else if (flush) {
    type = "同花";
    key = [1, ss[0], ...rs.toReversed()];
  } else if (straight) {
    type = "順子";
    key = [0, cards[4]];
  } else return null;
  return { type, key, size: n };
}
export function beats(cards, last) {
  const a = classify(cards),
    b = classify(last);
  return (
    !!a && (!last || (!!b && a.size === b.size && compare(a.key, b.key) > 0))
  );
}
export function newGame(names, random = Math.random) {
  if (!Array.isArray(names) || names.length < 2 || names.length > 4)
    throw Error("需要 2–4 位玩家");
  const shuffled = deck();
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const hands = names.map((_, p) =>
    shuffled.slice(p * 13, p * 13 + 13).sort((a, b) => a - b),
  );
  const opening = Math.min(...hands.flat());
  return {
    names: [...names],
    hands,
    opening,
    turn: hands.findIndex((h) => h.includes(opening)),
    first: true,
    last: null,
    lastSeat: null,
    passes: 0,
    winner: null,
    revision: 0,
    history: [],
  };
}
export function act(state, seat, cards) {
  if (state.winner !== null) throw Error("本局已結束");
  if (seat !== state.turn) throw Error("還沒輪到你");
  if (
    !Array.isArray(cards) ||
    cards.some((c) => !state.hands[seat].includes(c)) ||
    new Set(cards).size !== cards.length
  )
    throw Error("請選擇自己的手牌");
  if (!cards.length) {
    if (!state.last) throw Error("自由領出時不能過牌");
  } else {
    if (!classify(cards)) throw Error("這不是有效的牌型");
    if (state.first && !cards.includes(state.opening))
      throw Error(`第一手必須包含 ${label(state.opening)}`);
    if (!beats(cards, state.last)) throw Error("請出相同張數、較大的牌");
  }
  const g = {
    ...state,
    hands: state.hands.map((h) => [...h]),
    history: [...state.history],
    revision: state.revision + 1,
  };
  if (!cards.length) {
    g.passes++;
    g.history.unshift({ seat, text: "過牌", cards: [] });
    if (g.passes === g.names.length - 1) {
      g.last = null;
      g.passes = 0;
      g.turn = g.lastSeat;
    } else g.turn = (seat + 1) % g.names.length;
  } else {
    g.hands[seat] = g.hands[seat].filter((c) => !cards.includes(c));
    g.last = [...cards].sort((a, b) => a - b);
    g.lastSeat = seat;
    g.passes = 0;
    g.first = false;
    g.history.unshift({ seat, text: classify(cards).type, cards: g.last });
    g.turn = (seat + 1) % g.names.length;
    if (!g.hands[seat].length) g.winner = seat;
  }
  g.history = g.history.slice(0, 40);
  return g;
}
export function combinations(items, n) {
  const out = [];
  function walk(start, acc) {
    if (acc.length === n) {
      out.push(acc);
      return;
    }
    for (let i = start; i <= items.length - (n - acc.length); i++)
      walk(i + 1, [...acc, items[i]]);
  }
  walk(0, []);
  return out;
}
export function legalMoves(state, seat) {
  if (state.turn !== seat || state.winner !== null) return [];
  const hand = state.hands ? state.hands[seat] : state.hand;
  const sizes = state.last ? [state.last.length] : [1, 2, 3, 5];
  const moves = [];
  for (const n of sizes)
    for (const cards of combinations(hand, n))
      if (
        (!state.first || cards.includes(state.opening)) &&
        beats(cards, state.last)
      )
        moves.push(cards);
  if (state.last) moves.push([]);
  return moves;
}
export function snapshot(g, seat) {
  return {
    names: g.names,
    hand: g.hands[seat],
    counts: g.hands.map((h) => h.length),
    seat,
    opening: g.opening,
    turn: g.turn,
    first: g.first,
    last: g.last,
    lastSeat: g.lastSeat,
    passes: g.passes,
    winner: g.winner,
    revision: g.revision,
    history: g.history,
  };
}
