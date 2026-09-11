import { RANKS, rank } from "./rules.js";
const KEY = "sumi-club-record-v1";
const today = () => new Date().toLocaleDateString("sv-SE");
export function readRecord() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (
      r?.date === today() &&
      Number.isInteger(r.played) &&
      r.played >= 0 &&
      Number.isInteger(r.wins) &&
      r.wins >= 0 &&
      r.wins <= r.played
    )
      return r;
  } catch {}
  return { date: today(), played: 0, wins: 0 };
}
export function saveResult(won) {
  const r = readRecord();
  r.played++;
  if (won) r.wins++;
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {}
  return r;
}
export function renderDistribution(element, hand) {
  const d3 = globalThis.d3;
  if (!d3) return;
  const data = RANKS.map((r, i) => ({
    rank: r,
    count: hand.filter((c) => rank(c) === i).length,
  }));
  const svg = d3
    .select(element)
    .selectAll("svg")
    .data([null])
    .join("svg")
    .attr("viewBox", "0 0 480 130")
    .attr("role", "img")
    .attr(
      "aria-label",
      "手牌點數分布：" + data.map((d) => `${d.rank}：${d.count} 張`).join("，"),
    );
  const x = d3.scaleBand().domain(RANKS).range([8, 474]).padding(0.45),
    y = d3.scaleLinear().domain([0, 4]).range([93, 24]);
  svg
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", (d) => x(d.rank))
    .attr("y", (d) => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", (d) => 93 - y(d.count))
    .attr("fill", "#d8b878")
    .attr("rx", 2);
  svg
    .selectAll("text")
    .data(data)
    .join("text")
    .attr("x", (d) => x(d.rank) + x.bandwidth() / 2)
    .attr("y", 112)
    .attr("fill", "#a6b4aa")
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text((d) => d.rank);
}
