import * as THREE from "../vendor/three.module.js";
import { RANKS, SUITS, rank, suit } from "./rules.js";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export class CardTable {
  constructor(container) {
    this.container = container;
    this.meshes = [];
    this.textures = new Map();
    this.sequence = 0;
    this.frame = 0;
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      container.append(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      this.camera.position.set(0, -2, 15);
      this.camera.lookAt(0, 0, 0);
      this.scene.add(new THREE.AmbientLight(0xffffff, 2));
      const light = new THREE.DirectionalLight(0xfff1d0, 3);
      light.position.set(-3, 5, 8);
      this.scene.add(light);
      this.geometry = new THREE.BoxGeometry(0.93, 1.34, 0.035);
      this.edge = new THREE.MeshStandardMaterial({
        color: 0xd5cdb7,
        roughness: 0.85,
      });
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(container);
      this.resize();
      document.body.classList.add("has-webgl");
    } catch {
      this.renderer = null;
      container.textContent = "";
    }
  }
  resize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.draw();
  }
  texture(id) {
    if (this.textures.has(id)) return this.textures.get(id);
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 400;
    const c = canvas.getContext("2d");
    c.fillStyle = id === -1 ? "#264b3b" : "#f4efdf";
    c.fillRect(0, 0, 280, 400);
    if (id === -1) {
      c.strokeStyle = "#bbad7866";
      c.lineWidth = 1;
      for (let x = -400; x < 500; x += 18) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + 400, 400);
        c.stroke();
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x - 400, 400);
        c.stroke();
      }
      c.strokeStyle = "#d8b878";
      c.lineWidth = 3;
      c.strokeRect(12, 12, 256, 376);
      c.fillStyle = "#264b3b";
      c.fillRect(73, 144, 134, 112);
      c.fillStyle = "#d8b878";
      c.font = "70px Georgia";
      c.textAlign = "center";
      c.fillText("♠", 140, 214);
      c.font = "12px Georgia";
      c.fillText("SUMI CLUB", 140, 244);
    } else {
      c.fillStyle = [0, 2].includes(suit(id)) ? "#ab403e" : "#1a3029";
      const corner = () => {
        c.font = "bold 51px Georgia";
        c.fillText(RANKS[rank(id)], 19, 58);
        c.font = "38px Georgia";
        c.fillText(SUITS[suit(id)], 20, 99);
      };
      corner();
      c.save();
      c.translate(280, 400);
      c.rotate(Math.PI);
      corner();
      c.restore();
      c.textAlign = "center";
      c.font = "130px Georgia";
      c.fillText(SUITS[suit(id)], 140, 246);
      c.strokeStyle = "#c6bea655";
      c.strokeRect(7, 7, 266, 386);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(id, texture);
    return texture;
  }
  card(id) {
    const face = new THREE.MeshStandardMaterial({
      map: this.texture(id),
      roughness: 0.78,
    });
    const back = new THREE.MeshStandardMaterial({
      map: this.texture(-1),
      roughness: 0.8,
    });
    const mesh = new THREE.Mesh(this.geometry, [
      this.edge,
      this.edge,
      this.edge,
      this.edge,
      face,
      back,
    ]);
    this.scene.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }
  clear() {
    this.sequence++;
    cancelAnimationFrame(this.frame);
    this.cancelAnimation?.();
    this.cancelAnimation = null;
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.material[4].dispose();
      m.material[5].dispose();
    }
    this.meshes = [];
  }
  draw() {
    this.renderer?.render(this.scene, this.camera);
  }
  demo() {
    if (!this.renderer) return;
    this.clear();
    [35, 39, 43, 47, 51].forEach((id, i) => {
      const m = this.card(id);
      m.position.set((i - 2) * 0.64, -1.05, i * 0.06);
      m.rotation.z = (2 - i) * 0.13;
    });
    this.draw();
  }
  async animate(duration, update) {
    if (!this.renderer) return;
    const seq = this.sequence;
    const start = performance.now();
    return new Promise((resolve) => {
      this.cancelAnimation = resolve;
      const tick = (now) => {
        if (seq !== this.sequence) {
          resolve();
          return;
        }
        const p = Math.min((now - start) / (reduced() ? 1 : duration), 1);
        update(p);
        this.draw();
        if (p < 1) this.frame = requestAnimationFrame(tick);
        else {
          this.cancelAnimation = null;
          resolve();
        }
      };
      tick(start);
    });
  }
  async deal(count) {
    if (!this.renderer) return;
    this.clear();
    const seq = this.sequence;
    const stack = Array.from({ length: 20 }, (_, i) => {
      const m = this.card(-1);
      m.position.z = i * 0.04;
      return m;
    });
    await this.animate(700, (p) =>
      stack.forEach((m, i) => {
        m.position.x = Math.sin(p * Math.PI * 4) * (i % 2 ? 1 : -1) * 0.42;
        m.rotation.z = Math.sin(p * Math.PI * 2) * 0.08;
      }),
    );
    if (seq !== this.sequence) return;
    const positions =
      count === 2
        ? [
            [0, -3],
            [0, 2.5],
          ]
        : count === 3
          ? [
              [0, -3],
              [-4, 0.1],
              [4, 0.1],
            ]
          : [
              [0, -3],
              [-4, 0.1],
              [0, 2.5],
              [4, 0.1],
            ];
    await this.animate(1050, (p) =>
      stack.forEach((m, i) => {
        const t = Math.min(1, Math.max(0, (p - i * 0.02) * 2.6));
        const [x, y] = positions[i % count];
        m.position.x = x * t;
        m.position.y = y * t;
        m.position.z = (1 - t) * i * 0.04;
        m.scale.setScalar(1 - t * 0.55);
      }),
    );
    if (seq === this.sequence) {
      this.clear();
      this.draw();
    }
  }
  async play(cards, relativeSeat = 0) {
    if (!this.renderer) return;
    this.clear();
    const origins = [
      [0, -3],
      [-4, 0],
      [0, 3],
      [4, 0],
    ];
    const [ox, oy] = origins[relativeSeat] || origins[0];
    const meshes = cards.map((c) => this.card(c));
    await this.animate(400, (p) =>
      meshes.forEach((m, i) => {
        const t = 1 - (1 - p) ** 3;
        m.position.set(
          ox * (1 - t) + (i - (cards.length - 1) / 2) * 0.83 * t,
          oy * (1 - t) - 0.15 * t,
          Math.sin(p * Math.PI) * 1.4 + i * 0.035,
        );
        m.rotation.z = (i - (cards.length - 1) / 2) * -0.055 * t;
      }),
    );
  }
  dispose() {
    this.clear();
    this.observer?.disconnect();
    this.geometry?.dispose();
    this.edge?.dispose();
    this.textures.forEach((t) => t.dispose());
    this.renderer?.dispose();
  }
}
