import * as THREE from "three";
import { HURDLES, jumpZone } from "./race.js";

const LANE_X = -0.61;
export class Stadium {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#bee5ec");
    this.scene.fog = new THREE.Fog("#cee5e8", 70, 220);
    this.camera = new THREE.PerspectiveCamera(63, 1, 0.08, 270);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight("#fff6df", "#699b98", 3.2));
    const sunlight = new THREE.DirectionalLight("#fff4db", 3.0);
    sunlight.position.set(-30, 60, 25);
    this.scene.add(sunlight);
    this.materials = new Map();
    this.hurdleGroups = [];
    this.glows = [];
    this.flags = [];
    this.active = 0;
    this.flash = 0;
    this.build();
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
  }
  material(color) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.87 }),
      );
    return this.materials.get(color);
  }
  box(w, h, d, x, y, z, color, parent = this.scene) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.material(color),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  text(
    text,
    x,
    y,
    z,
    width,
    { color = "#fff9ec", background = null, ground = false } = {},
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 1024, 256);
    }
    ctx.font = "900 160px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 512, 138);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width / 4),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(x, y, z);
    if (ground) mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh);
    return mesh;
  }
  build() {
    this.box(800, 0.2, 800, 0, -0.22, -30, "#82aa79");
    this.box(180, 0.16, 230, 0, -0.09, -45, "#72ae85");
    this.box(10.3, 0.1, 160, 0, 0, -55, "#ce654c");
    for (let i = 0; i < 8; i++) {
      const x = (i - 3.5) * 1.22;
      if (i % 2) this.box(1.2, 0.005, 160, x, 0.053, -55, "#c45e47");
      this.text(String(i + 1), x, 0.065, 0.3, 0.75, { ground: true });
      for (let d = 10; d < 100; d += 10)
        this.box(0.22, 0.007, 0.055, x - 0.48, 0.061, -d, "#efbe9d");
    }
    for (let i = 0; i <= 8; i++)
      this.box(0.045, 0.01, 160, (i - 4) * 1.22, 0.06, -55, "#fff2d5");
    this.box(9.8, 0.012, 0.14, 0, 0.064, 0, "#fff7e3");
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 32; col++) {
        this.box(
          0.305,
          0.015,
          0.3,
          -4.73 + col * 0.305,
          0.07,
          -100 - row * 0.3,
          (col + row) % 2 ? "#263d39" : "#fff7e3",
        );
      }
    this.text("100", 0, 0.07, -97.5, 3, { ground: true });
    for (let d = 20; d <= 80; d += 20) {
      this.text(`${d} m`, -6.8, 0.07, -d, 2.0, {
        ground: true,
        color: "#f7f1d7",
      });
      this.box(0.08, 0.55, 0.08, -5.8, 0.28, -d, "#f8f4d8");
    }
    // Warm-up lanes and the field make the straight feel part of a full stadium.
    this.box(22, 0.04, 115, 17, 0.01, -48, "#86b785");
    this.box(0.07, 0.01, 90, 12, 0.041, -45, "#dbe3c1");
    this.box(0.07, 0.01, 90, 23, 0.041, -45, "#dbe3c1");
    this.box(11, 0.01, 0.07, 17.5, 0.041, 0, "#dbe3c1");
    this.box(11, 0.01, 0.07, 17.5, 0.041, -90, "#dbe3c1");
    for (const side of [-1, 1]) {
      const inner = side === -1 ? 9 : 31;
      for (let row = 0; row < 10; row++) {
        const x = side * (inner + row * 0.85);
        this.box(0.9, 0.6 + row * 0.53, 166, x, row * 0.265, -48, "#dddac8");
        for (let section = 0; section < 9; section++) {
          this.box(
            0.65,
            0.18,
            15.3,
            x,
            0.55 + row * 0.53,
            23 - section * 18,
            (row + section) % 5 < 2
              ? "#e88a5b"
              : (row + section) % 5 < 4
                ? "#447e7b"
                : "#f6e3bc",
          );
        }
      }
      this.box(12, 0.24, 174, side * (inner + 4), 9.2, -48, "#f0ecda");
      this.box(0.4, 0.38, 174, side * (inner - 1.8), 9.14, -48, "#366663");
      for (let z = 28; z > -130; z -= 25) {
        this.box(0.22, 9.5, 0.22, side * (inner + 8), 4.75, z, "#d4ddd0");
        this.box(0.1, 3.2, 0.1, side * 7.2, 1.6, z, "#eeebd8");
        const flag = this.box(
          0.7,
          1.65,
          0.04,
          side * 7.2 + 0.38,
          2.45,
          z,
          z % 2 ? "#f1aa62" : "#147e75",
        );
        this.flags.push(flag);
      }
      this.box(0.12, 0.85, 168, side * (inner - 1), 0.42, -48, "#ede7d6");
      for (let z = 20; z > -125; z -= 14) {
        const sign = this.text(
          z % 3 ? "PACE / MOTION" : "FIND YOUR PACE",
          side * (inner - 1.08),
          0.48,
          z,
          5.2,
          { background: "#154e48", color: "#f7efcc" },
        );
        sign.rotation.y = (side * -Math.PI) / 2;
      }
    }
    // One instanced draw call for the spectators.
    const crowd = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.18, 5, 4),
      this.material("#ffffff"),
      1000,
    );
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    const palette = ["#244f57", "#f5dca1", "#d26d48", "#ece6d0", "#699b98"];
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 1000; i++) {
      const side = i % 2 ? -1 : 1,
        row = Math.floor(random() * 10);
      transform.position.set(
        side * ((side < 0 ? 9 : 31) + row * 0.85),
        0.95 + row * 0.53,
        29 - random() * 160,
      );
      transform.scale.set(1, 1.8, 1);
      transform.updateMatrix();
      crowd.setMatrixAt(i, transform.matrix);
      crowd.setColorAt(i, color.set(palette[i % palette.length]));
    }
    this.scene.add(crowd);
    for (const [x, z] of [
      [-20, 4],
      [43, -5],
      [-20, -105],
      [43, -105],
    ]) {
      this.box(0.35, 23, 0.35, x, 11.5, z, "#76958d");
      this.box(5.5, 2, 0.28, x, 23, z, "#577a76");
      for (let i = 0; i < 5; i++)
        this.box(0.75, 1.1, 0.08, x - 2 + i, 23, z + 0.2, "#fff6d7");
    }
    this.box(10, 4.5, 0.6, 0, 6, -121, "#264d47");
    this.text("PACE", 0, 6.6, -120.65, 7.4);
    this.text("100 M  /  FINISH", 0, 5.2, -120.64, 6.8, { color: "#b8e6b8" });
    this.box(0.4, 6, 0.4, -3.5, 3, -121, "#4d7368");
    this.box(0.4, 6, 0.4, 3.5, 3, -121, "#4d7368");
    for (const x of [-5.4, 5.4])
      this.box(0.2, 3.6, 0.2, x, 1.8, -100, "#f4edcf");
    this.text("FINISH", 0, 3.4, -100, 10, {
      background: "#205b50",
      color: "#fcf3da",
    });
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 24, 16),
      new THREE.MeshBasicMaterial({ color: "#fff4ce", fog: false }),
    );
    sun.position.set(-90, 88, -160);
    this.scene.add(sun);
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 6),
        this.material("#e7f0e8"),
      );
      cloud.position.set(-100 + i * 17, 31 + (i % 3) * 8, -130 - (i % 4) * 12);
      cloud.scale.set(13, 2, 4);
      this.scene.add(cloud);
    }
    for (const distance of HURDLES) {
      const group = new THREE.Group();
      group.position.set(LANE_X, 0, -distance);
      for (const x of [-0.52, 0.52]) {
        this.box(0.07, 0.8, 0.07, x, 0.4, 0, "#eae9d5", group);
        this.box(0.1, 0.06, 0.6, x, 0.08, 0.21, "#315d58", group);
      }
      this.box(1.16, 0.16, 0.1, 0, 0.83, 0, "#f7f2dc", group);
      for (const x of [-0.44, 0, 0.44])
        this.box(0.21, 0.165, 0.105, x, 0.83, 0.005, "#e86639", group);
      this.scene.add(group);
      this.hurdleGroups.push(group);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: "#9fff58",
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 1),
        glowMaterial,
      );
      glow.rotation.x = -Math.PI / 2;
      glow.renderOrder = 2;
      this.scene.add(glow);
      this.glows.push(glow);
      const edgeMaterial = new THREE.MeshBasicMaterial({
        color: "#e3ffc7",
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      for (const x of [-0.55, 0.55]) {
        const edge = new THREE.Mesh(
          new THREE.PlaneGeometry(0.035, 1),
          edgeMaterial,
        );
        edge.position.set(x, 0, 0.004);
        glow.add(edge);
      }
      for (const y of [-0.3, 0, 0.3])
        for (const side of [-1, 1]) {
          const arrow = new THREE.Mesh(
            new THREE.PlaneGeometry(0.32, 0.025),
            edgeMaterial,
          );
          arrow.position.set(side * 0.12, y, 0.005);
          arrow.rotation.z = side * -0.5;
          glow.add(arrow);
        }
    }
    this.hands = new THREE.Group();
    this.camera.add(this.hands);
    this.arms = [-1, 1].map((side) => {
      const group = new THREE.Group();
      group.position.set(side * 0.37, -0.5, -0.52);
      this.box(0.16, 0.28, 0.17, 0, -0.13, 0, "#1c6259", group);
      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 10, 8),
        this.material("#ddb18c"),
      );
      hand.position.set(0, 0.06, -0.02);
      group.add(hand);
      this.hands.add(group);
      return group;
    });
  }
  resize() {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  render(race, dt, elapsed, reduceMotion = false) {
    const playing = race.phase !== "ready";
    this.active += ((playing ? 1 : 0) - this.active) * Math.min(1, dt * 5);
    const mix = this.active;
    const bob = reduceMotion
      ? 0
      : Math.sin(elapsed * 14) * Math.min(0.025, race.speed * 0.003);
    const idleX = 10.5 + Math.sin(elapsed * 0.1) * 0.2;
    this.camera.position.set(
      THREE.MathUtils.lerp(idleX, LANE_X, mix),
      THREE.MathUtils.lerp(6.7, 1.54 + race.height + bob, mix),
      THREE.MathUtils.lerp(10, 1.2 - race.distance, mix),
    );
    this.camera.lookAt(
      THREE.MathUtils.lerp(-0.8, LANE_X, mix),
      THREE.MathUtils.lerp(0.0, 1.4 + race.height, mix),
      THREE.MathUtils.lerp(-27, -race.distance - 25, mix),
    );
    this.camera.fov = 63 + (reduceMotion ? 0 : race.speed * 0.6) * mix;
    this.camera.updateProjectionMatrix();
    this.hands.visible = mix > 0.95 && race.phase !== "finished";
    this.arms.forEach((arm, i) => {
      const swing =
        Math.sin(elapsed * (5 + race.speed * 0.9) + i * Math.PI) *
        Math.min(1, race.speed / 4);
      arm.position.y = -0.5 + swing * 0.07;
      arm.rotation.x = -0.4 + swing * 0.3;
    });
    this.hurdleGroups.forEach((group, i) => {
      group.visible = race.mode === "hurdles";
      const hurdle = race.hurdles[i];
      group.rotation.x = hurdle?.state === "hit" ? -1.1 : 0;
      const glow = this.glows[i];
      glow.visible =
        group.visible &&
        (!hurdle || hurdle.state === "ahead") &&
        (!playing || race.speed >= 0.4);
      const zone = jumpZone(playing ? race.speed : 7);
      glow.position.set(
        LANE_X,
        0.078,
        -HURDLES[i] + (zone.near + zone.far) / 2,
      );
      glow.scale.y = zone.far - zone.near;
      glow.material.opacity =
        race.inJumpZone && hurdle === race.nextHurdle
          ? 0.88 + Math.sin(elapsed * 13) * 0.1
          : 0.65;
    });
    this.flags.forEach((flag, i) => {
      flag.rotation.y = Math.sin(elapsed * 2 + i) * 0.17;
    });
    this.renderer.render(this.scene, this.camera);
  }
}
