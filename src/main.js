import {
  newGame,
  act,
  snapshot,
  legalMoves,
  label,
  rank,
  suit,
  RANKS,
  SUITS,
  classify,
} from "./rules.js";
import { chooseMove, LEVELS } from "./ai.js";
import { CardTable } from "./table.js";
import { PeerRoom, validAction } from "./network.js";
import { readRecord, saveResult, renderDistribution } from "./stats.js";
const $ = (id) => document.getElementById(id);
const table = new CardTable($("three-stage"));
let game = null,
  view = null,
  selected = new Set(),
  level = 1,
  mode = "cpu",
  timer = null,
  busy = false,
  generation = 0,
  sortSuit = false,
  sound = false,
  audio = null,
  roomRole = null,
  disconnected = false,
  seatMap = new Map(),
  recorded = false;
function message(text) {
  $("status").textContent = text;
}
function tone() {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    audio.resume();
    const o = audio.createOscillator(),
      gain = audio.createGain();
    o.connect(gain);
    gain.connect(audio.destination);
    o.frequency.setValueAtTime(420, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(230, audio.currentTime + 0.09);
    gain.gain.setValueAtTime(0.025, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
    o.start();
    o.stop(audio.currentTime + 0.13);
  } catch {}
}
function updateRecord() {
  const r = readRecord();
  $("played").textContent = r.played;
  $("wins").textContent = r.wins;
  $("win-rate").textContent = r.played
    ? Math.round((r.wins / r.played) * 100) + "%"
    : "—";
}
function cardElement(id, interactive = false) {
  const b = document.createElement(interactive ? "button" : "div");
  b.className = "card" + ([0, 2].includes(suit(id)) ? " red" : "");
  b.dataset.card = id;
  b.setAttribute("aria-label", label(id));
  const corner = document.createElement("span");
  corner.className = "card-corner";
  corner.textContent = RANKS[rank(id)];
  const s = document.createElement("small");
  s.textContent = SUITS[suit(id)];
  corner.append(s);
  const center = document.createElement("span");
  center.className = "card-center";
  center.textContent = SUITS[suit(id)];
  const bottom = document.createElement("span");
  bottom.className = "card-bottom";
  bottom.textContent = RANKS[rank(id)] + SUITS[suit(id)];
  b.append(corner, center, bottom);
  if (interactive) {
    b.type = "button";
    b.setAttribute("aria-pressed", selected.has(id));
    b.classList.toggle("selected", selected.has(id));
    b.addEventListener("click", () => {
      if (
        !view ||
        busy ||
        disconnected ||
        view.turn !== view.seat ||
        view.winner !== null
      )
        return;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      b.classList.toggle("selected", selected.has(id));
      b.setAttribute("aria-pressed", selected.has(id));
      updateActions();
      tone();
    });
  }
  return b;
}
function renderSeats() {
  $("seats").replaceChildren();
  const names = view?.names || ["你", "青山", "阿棠", "老陳"];
  const seat = view?.seat || 0;
  const others = names
    .map((name, i) => ({ name, i }))
    .filter((p) => p.i !== seat);
  const positions =
    others.length === 1 ? [0] : others.length === 2 ? [1, 2] : [1, 0, 2];
  others.forEach((p, k) => {
    const el = document.createElement("div");
    el.className =
      `seat pos-${positions[k]}` +
      (view?.turn === p.i && view?.winner === null ? " active" : "");
    const avatar = document.createElement("span");
    avatar.className = "seat-avatar";
    avatar.textContent = p.name[0];
    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = p.name;
    const sub = document.createElement("small");
    const active = view?.turn === p.i && view?.winner === null;
    sub.className = active ? "seat-turn" : "";
    sub.textContent = active
      ? "輪到出牌"
      : `${view?.counts[p.i] ?? 13} 張 · ${mode === "cpu" ? LEVELS[level] : "好友"}`;
    info.append(name, sub);
    el.append(avatar, info);
    $("seats").append(el);
  });
}
function updateActions() {
  const can =
    !!view &&
    !busy &&
    !disconnected &&
    view.winner === null &&
    view.turn === view.seat;
  const cards = [...selected].sort((a, b) => a - b);
  const legal =
    can &&
    legalMoves(view, view.seat).some(
      (m) =>
        m.length &&
        m.length === cards.length &&
        m.every((c, i) => c === cards[i]),
    );
  $("play").disabled = !legal;
  $("hint").disabled = !can;
  $("pass").disabled = !can || !view.last;
  $("selection-count").textContent = selected.size || "↗";
  $("hand")
    .querySelectorAll("button")
    .forEach((b) => (b.disabled = !can));
  if (can && selected.size)
    message(
      `${selected.size} 張 · ${classify(cards)?.type || "無效牌型"}${legal ? "，可以出牌" : "，請選擇能壓過前手的牌"}`,
    );
}
function render() {
  renderSeats();
  if (!view) return;
  $("table-announcement").hidden = true;
  $("hand-count").textContent = `${view.hand.length} 張`;
  $("hand").replaceChildren();
  const hand = [...view.hand].sort(
    sortSuit ? (a, b) => suit(a) - suit(b) || a - b : (a, b) => a - b,
  );
  hand.forEach((id, i) => {
    const card = cardElement(id, true);
    card.style.setProperty(
      "--angle",
      `${(i - (hand.length - 1) / 2) * 0.5}deg`,
    );
    $("hand").append(card);
  });
  $("played-cards").replaceChildren(
    ...(view.last || []).map((id) => cardElement(id)),
  );
  $("table-caption").textContent = view.last
    ? `${view.names[view.lastSeat]} · ${classify(view.last).type} · ${view.passes} 人過牌`
    : view.first
      ? `${label(view.opening)} 先行`
      : "自由領出 · 可以選擇新的牌型";
  if (disconnected) message("連線已中斷。請離開連線室並重新邀請。");
  else if (busy) message("理好手牌，準備開局…");
  else if (view.winner !== null)
    message(`${view.names[view.winner]} 先出完了手牌。好局！`);
  else if (view.turn === view.seat)
    message(
      view.first
        ? `輪到你，第一手請包含 ${label(view.opening)}。`
        : view.last
          ? "輪到你，選牌壓過前手，或過牌。"
          : "其他人都過牌了。由你自由領出。",
    );
  else message(`等候 ${view.names[view.turn]} 出牌…`);
  updateActions();
  renderHistory();
}
function renderHistory() {
  $("history").replaceChildren();
  const history = view?.history || [];
  if (!history.length) {
    const li = document.createElement("li");
    li.textContent = "牌路從第一手開始。";
    $("history").append(li);
  }
  history.forEach((h) => {
    const li = document.createElement("li");
    li.textContent = `${view.names[h.seat]} · ${h.text}`;
    const small = document.createElement("small");
    small.textContent = h.cards.map(label).join("  ");
    li.append(small);
    $("history").append(li);
  });
  renderDistribution($("distribution"), view?.hand || []);
}
function reset() {
  clearTimeout(timer);
  generation++;
  busy = false;
  selected.clear();
  recorded = false;
  disconnected = false;
  table.clear();
  $("result-dialog").close();
}
async function startCPU() {
  if (mode !== "cpu") return;
  reset();
  const run = generation;
  game = newGame([
    "你",
    ...["青山", "阿棠", "老陳"].slice(0, Number($("cpu-count").value)),
  ]);
  view = snapshot(game, 0);
  busy = true;
  render();
  $("start").disabled = true;
  await table.deal(game.names.length);
  if (run !== generation) return;
  busy = false;
  $("start").disabled = false;
  render();
  scheduleCPU();
}
function scheduleCPU() {
  clearTimeout(timer);
  if (
    mode !== "cpu" ||
    !game ||
    game.winner !== null ||
    game.turn === 0 ||
    busy
  )
    return;
  const run = generation;
  timer = setTimeout(() => {
    if (run !== generation || mode !== "cpu") return;
    try {
      commit(game.turn, chooseMove(game, game.turn, level));
    } catch (e) {
      message(e.message);
    }
  }, 850);
}
function broadcast(deal = false) {
  for (const [peer, seat] of seatMap)
    room.send(peer, { type: "state", view: snapshot(game, seat), deal });
}
function commit(seat, cards) {
  const next = act(game, seat, cards);
  game = next;
  if (mode === "online") broadcast();
  receive(snapshot(game, 0), false);
  tone();
}
async function receive(next, deal = false) {
  const old = view;
  view = next;
  selected.clear();
  const run = generation;
  if (deal) {
    recorded = false;
    busy = true;
    render();
    await table.deal(next.names.length);
  } else if (
    next.last &&
    (!old || next.revision !== old.revision) &&
    next.history[0]?.cards.length
  ) {
    busy = true;
    render();
    await table.play(
      next.last,
      (next.lastSeat - next.seat + next.names.length) % next.names.length,
    );
  } else if (!next.last) {
    table.clear();
    table.draw();
  }
  if (run !== generation || view !== next) return;
  busy = false;
  render();
  if (view.winner !== null) finish();
  else scheduleCPU();
}
function finish() {
  if (recorded) return;
  recorded = true;
  saveResult(view.winner === view.seat);
  updateRecord();
  $("result-title").textContent =
    view.winner === view.seat
      ? "這一手，你贏了。"
      : `${view.names[view.winner]}，好一手牌。`;
  $("result-copy").textContent = "輸贏留在這一局，下手牌又是新的開始。";
  $("result-scores").replaceChildren();
  view.names.forEach((name, i) => {
    const s = document.createElement("span");
    s.textContent = `${name} · ${view.counts[i]} 張`;
    $("result-scores").append(s);
  });
  $("again").disabled = mode === "online" && roomRole !== "host";
  $("result-dialog").showModal();
}
function submit(cards) {
  if (!view || busy || disconnected || view.turn !== view.seat) return;
  try {
    if (mode === "online" && roomRole === "guest") {
      room.send(0, { type: "action", revision: view.revision, cards });
      busy = true;
      updateActions();
      message("出牌已送出，等候房主確認…");
    } else commit(view.seat, cards);
  } catch (e) {
    message(e.message);
  }
}
function hint() {
  if ($("hint").disabled) return;
  selected = new Set(chooseMove(view, view.seat, 2));
  render();
  if (!selected.size) message("沒有能壓過前手的牌，這次可以過牌。");
}
function switchMode(next) {
  if (mode === next) return;
  reset();
  room.close();
  roomRole = null;
  game = null;
  view = null;
  mode = next;
  $("start").disabled = false;
  $("cpu-mode").classList.toggle("active", mode === "cpu");
  $("online-mode").classList.toggle("active", mode === "online");
  $("cpu-mode").setAttribute("aria-pressed", mode === "cpu");
  $("online-mode").setAttribute("aria-pressed", mode === "online");
  $("cpu-settings").hidden = mode !== "cpu";
  $("online-settings").hidden = mode !== "online";
  $("room-label").textContent = mode === "cpu" ? "練習牌桌" : "好友牌桌";
  demo();
}
function demo() {
  table.demo();
  $("table-announcement").hidden = false;
  $("played-cards").replaceChildren();
  $("hand").replaceChildren(
    ...[0, 5, 10, 14, 17, 22, 27, 31, 35, 39, 43, 47, 51].map((id) => {
      const c = cardElement(id);
      c.classList.add("preview");
      return c;
    }),
  );
  $("hand-count").textContent = "13 張";
  $("table-caption").textContent = "最小牌先行 · 先出完手牌者勝";
  message(
    mode === "cpu"
      ? "準備好了嗎？入座，開始你的第一局。"
      : "開啟連線室，邀請朋友同桌。",
  );
  renderSeats();
  updateActions();
}
const room = new PeerRoom({
  onStatus: (text) => {
    $("network-status").textContent = text;
    $("online-start").disabled =
      roomRole !== "host" ||
      room.connected().length < 1 ||
      room.pending !== null ||
      disconnected;
  },
  onDisconnect: () => {
    if (roomRole) {
      if (roomRole === "host")
        for (const peer of room.connected())
          room.send(peer, { type: "room-ended" });
      disconnected = true;
      clearTimeout(timer);
      $("network-status").textContent = "有玩家離線，請離開連線後重新邀請。";
      $("online-start").disabled = true;
      render();
    }
  },
  onMessage: (msg, peer) => {
    if (roomRole === "host" && game && validAction(msg)) {
      try {
        if (disconnected) throw Error("連線已中斷");
        if (msg.revision !== game.revision) throw Error("牌局已更新，請重試");
        const seat = seatMap.get(peer);
        if (seat === undefined) throw Error("尚未入座");
        commit(seat, msg.cards);
      } catch (e) {
        room.send(peer, { type: "error", text: e.message });
      }
    } else if (roomRole === "guest") {
      if (msg.type === "room-ended") {
        disconnected = true;
        busy = false;
        $("network-status").textContent = "有玩家離線，請離開連線後重新邀請。";
        render();
        return;
      }
      if (
        msg.type === "state" &&
        msg.view &&
        Array.isArray(msg.view.hand) &&
        Array.isArray(msg.view.names)
      ) {
        if (!msg.deal && view && msg.view.revision <= view.revision) return;
        if (msg.deal) {
          reset();
          $("room-dialog").close();
        }
        receive(msg.view, !!msg.deal);
      } else if (msg.type === "error") {
        busy = false;
        render();
        message(typeof msg.text === "string" ? msg.text : "出牌未成功");
      }
    }
  },
});
async function safeNetwork(fn) {
  try {
    await fn();
  } catch (e) {
    $("network-status").textContent = e.message || "無法建立連線，請重新邀請";
  }
}
function startOnline() {
  if (roomRole !== "host" || disconnected || room.pending !== null) return;
  const peers = room.connected();
  if (peers.length < 1) return;
  reset();
  seatMap = new Map(peers.map((p, i) => [p, i + 1]));
  game = newGame(["房主", ...peers.map((_, i) => `牌友 ${i + 1}`)]);
  view = null;
  broadcast(true);
  receive(snapshot(game, 0), true);
  $("room-dialog").close();
}
$("start").onclick = startCPU;
$("play").onclick = () => submit([...selected].sort((a, b) => a - b));
$("pass").onclick = () => submit([]);
$("hint").onclick = hint;
$("cpu-mode").onclick = () => switchMode("cpu");
$("online-mode").onclick = () => switchMode("online");
$("difficulty").onclick = (e) => {
  const b = e.target.closest("[data-level]");
  if (!b) return;
  level = Number(b.dataset.level);
  $("difficulty")
    .querySelectorAll("button")
    .forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", x === b);
    });
  $("difficulty-note").textContent = [
    "先認識牌型，輕鬆試試手氣。",
    "穩健出牌，適合慢慢找回手感。",
    "懂得留牌，開始考驗你的牌路。",
    "看牌勢、守關鍵牌，每一步都算數。",
  ][level];
  renderSeats();
};
$("sort").onclick = () => {
  sortSuit = !sortSuit;
  $("sort").textContent = sortSuit ? "依花色排列 ↕" : "依點數排列 ↕";
  render();
};
$("sound").onclick = () => {
  sound = !sound;
  $("sound").setAttribute("aria-pressed", sound);
  $("sound").textContent = sound ? "音效 開" : "音效 關";
  tone();
};
for (const [button, dialog] of [
  ["rules-open", "rules-dialog"],
  ["log-open", "log-dialog"],
  ["room-open", "room-dialog"],
])
  $(button).onclick = () => $(dialog).showModal();
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
$("again").onclick = () => {
  if (mode === "cpu") startCPU();
  else startOnline();
};
$("host-room").onclick = () =>
  safeNetwork(async () => {
    reset();
    game = null;
    view = null;
    roomRole = "host";
    room.init(true);
    $("host-controls").hidden = false;
    $("code-in").value = "";
    $("code-out").value = "";
    demo();
  });
$("join-room").onclick = () =>
  safeNetwork(async () => {
    reset();
    game = null;
    view = null;
    roomRole = "guest";
    room.init(false);
    $("host-controls").hidden = true;
    $("code-in").value = "";
    $("code-out").value = "";
    demo();
  });
$("leave-room").onclick = () => {
  room.close();
  roomRole = null;
  reset();
  game = null;
  view = null;
  $("host-controls").hidden = true;
  $("network-status").textContent = "已離開連線，可以重新建立或加入";
  $("code-in").value = "";
  $("code-out").value = "";
  demo();
};
$("invite").onclick = () =>
  safeNetwork(async () => {
    if (game && game.winner === null)
      throw Error("請先完成本局或離開後重建房間");
    $("invite").disabled = true;
    try {
      $("network-status").textContent = "正在準備連線碼…";
      $("code-out").value = await room.invite();
      $("network-status").textContent =
        "邀請碼已就緒，傳給一位朋友，並等候他的回覆碼。";
      $("online-start").disabled = true;
    } finally {
      $("invite").disabled = false;
    }
  });
$("cancel-invite").onclick = () => {
  room.cancelInvite();
  $("code-out").value = "";
};
$("apply-code").onclick = () =>
  safeNetwork(async () => {
    if (!roomRole) throw Error("請先選擇房主或加入");
    $("apply-code").disabled = true;
    try {
      const code = await room.apply($("code-in").value);
      if (code) {
        $("code-out").value = code;
        $("network-status").textContent = "回覆碼已就緒，請傳回房主完成連線。";
      } else {
        $("code-out").value = "";
        $("network-status").textContent = "已套用回覆碼，正在連線…";
      }
    } finally {
      $("apply-code").disabled = false;
    }
  });
$("copy-code").onclick = () =>
  safeNetwork(async () => {
    if (!$("code-out").value) throw Error("尚未產生連線碼");
    try {
      await navigator.clipboard.writeText($("code-out").value);
      $("network-status").textContent = "連線碼已複製";
    } catch {
      $("code-out").focus();
      $("code-out").select();
      $("network-status").textContent = "請使用 Ctrl+C 或長按複製選取的連線碼";
    }
  });
$("online-start").onclick = startOnline;
document.addEventListener("keydown", (e) => {
  if (
    document.querySelector("dialog[open]") ||
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName) ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (e.key.toLowerCase() === "h") hint();
  if (e.key.toLowerCase() === "p" && !$("pass").disabled) submit([]);
  if (e.key === "Enter" && !$("play").disabled)
    submit([...selected].sort((a, b) => a - b));
  if (e.key === "Escape") {
    selected.clear();
    render();
  }
});
window.addEventListener("pagehide", () => {
  clearTimeout(timer);
  room.close();
  table.dispose();
});
updateRecord();
demo();
