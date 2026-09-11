const VERSION = 1;
export function parseCode(value, expected) {
  if (typeof value !== "string" || value.length > 64000)
    throw Error("連線碼格式不正確");
  try {
    const data = JSON.parse(atob(value.trim()));
    if (
      data.v !== VERSION ||
      data.type !== expected ||
      typeof data.sdp !== "string" ||
      data.sdp.length > 50000 ||
      !data.sdp.startsWith("v=0")
    )
      throw Error();
    return { type: data.type, sdp: data.sdp };
  } catch {
    throw Error("連線碼無效或類型不符，請重新複製完整內容");
  }
}
export function validAction(msg) {
  return (
    msg &&
    msg.type === "action" &&
    Number.isInteger(msg.revision) &&
    Array.isArray(msg.cards) &&
    msg.cards.length <= 5 &&
    msg.cards.every((c) => Number.isInteger(c) && c >= 0 && c < 52) &&
    new Set(msg.cards).size === msg.cards.length
  );
}
export class PeerRoom {
  constructor({ onMessage, onStatus, onDisconnect } = {}) {
    this.onMessage = onMessage || (() => {});
    this.onStatus = onStatus || (() => {});
    this.onDisconnect = onDisconnect || (() => {});
    this.peers = new Map();
    this.host = false;
    this.nextSeat = 1;
    this.pending = null;
    this.closed = false;
  }
  init(host) {
    this.close();
    this.closed = false;
    this.host = host;
    this.nextSeat = 1;
    this.onStatus(host ? "房間已建立，請產生邀請碼" : "請貼上房主提供的邀請碼");
  }
  createPeer(seat) {
    if (!globalThis.RTCPeerConnection)
      throw Error("瀏覽器不支援 WebRTC，請改用新版 Chrome、Edge 或 Firefox");
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const item = { pc, channel: null, seat };
    this.peers.set(seat, item);
    pc.onconnectionstatechange = () => {
      if (
        ["failed", "disconnected", "closed"].includes(pc.connectionState) &&
        !this.closed
      ) {
        this.onStatus("連線中斷，請離開後重新邀請");
        this.onDisconnect(seat);
      }
    };
    const attach = (channel) => {
      item.channel = channel;
      channel.onopen = () => {
        clearTimeout(item.timeout);
        if (this.host) {
          this.pending = null;
          this.send(seat, { type: "welcome", seat });
        }
        this.onStatus(`已連線 ${this.connected().length + 1} 人`);
      };
      channel.onclose = () => {
        if (!this.closed && this.peers.has(seat)) this.onDisconnect(seat);
      };
      channel.onmessage = (e) => {
        if (typeof e.data !== "string" || e.data.length > 64000) return;
        try {
          const msg = JSON.parse(e.data);
          if (msg && typeof msg === "object") this.onMessage(msg, seat);
        } catch {
          this.onStatus("收到無效訊息，已略過");
        }
      };
    };
    if (this.host) attach(pc.createDataChannel("sumi-v1"));
    else pc.ondatachannel = (e) => attach(e.channel);
    return item;
  }
  async gather(pc) {
    if (pc.iceGatheringState === "complete") return;
    await new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      };
      const check = () => {
        if (pc.iceGatheringState === "complete") finish();
      };
      const timer = setTimeout(finish, 7000);
      pc.addEventListener("icegatheringstatechange", check);
    });
  }
  code(pc) {
    return btoa(
      JSON.stringify({
        v: VERSION,
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      }),
    );
  }
  async invite() {
    if (!this.host) throw Error("請先選擇我是房主");
    if (this.pending !== null) throw Error("請先完成或取消上一份邀請");
    if (this.peers.size >= 3) throw Error("四個座位已滿");
    const seat = this.nextSeat++;
    this.pending = seat;
    const { pc } = this.createPeer(seat);
    await pc.setLocalDescription(await pc.createOffer());
    await this.gather(pc);
    return this.code(pc);
  }
  async apply(value) {
    if (this.host) {
      if (this.pending === null) throw Error("請先產生邀請碼");
      const desc = parseCode(value, "answer");
      const item = this.peers.get(this.pending);
      await item.pc.setRemoteDescription(desc);
      this.watch(item);
      return "";
    }
    const desc = parseCode(value, "offer");
    if (this.peers.size) throw Error("已有連線，請先離開再加入");
    const item = this.createPeer(0);
    await item.pc.setRemoteDescription(desc);
    await item.pc.setLocalDescription(await item.pc.createAnswer());
    await this.gather(item.pc);
    this.watch(item);
    return this.code(item.pc);
  }
  watch(item) {
    item.timeout = setTimeout(() => {
      if (item.channel?.readyState !== "open")
        this.onStatus(
          "30 秒內未連上；請檢查回覆碼，或取消並重新邀請。部分網路無法直連。",
        );
    }, 30000);
  }
  cancelInvite() {
    if (this.pending === null) return;
    const seat = this.pending,
      item = this.peers.get(seat);
    clearTimeout(item?.timeout);
    this.peers.delete(seat);
    this.pending = null;
    if (item) {
      item.pc.onconnectionstatechange = null;
      if (item.channel) item.channel.onclose = null;
      item.pc.close();
    }
    this.onStatus("已取消邀請，可以產生新的邀請碼");
  }
  connected() {
    return [...this.peers.values()]
      .filter((p) => p.channel?.readyState === "open")
      .map((p) => p.seat);
  }
  send(seat, msg) {
    const p = this.peers.get(seat);
    if (p?.channel?.readyState === "open") p.channel.send(JSON.stringify(msg));
  }
  close() {
    this.closed = true;
    for (const p of this.peers.values()) {
      clearTimeout(p.timeout);
      p.pc.onconnectionstatechange = null;
      p.pc.ondatachannel = null;
      if (p.channel) {
        p.channel.onclose = null;
        p.channel.onmessage = null;
        p.channel.onopen = null;
      }
      p.pc.close();
    }
    this.peers.clear();
    this.pending = null;
  }
}
