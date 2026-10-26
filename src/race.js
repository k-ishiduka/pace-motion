export const RACE_LENGTH = 100;
export const HURDLES = [16, 26, 36, 46, 56, 66, 76, 86];
export const JUMP_DURATION = 0.8;

export function jumpHeight(elapsed) {
  const t = elapsed / JUMP_DURATION;
  return t > 0 && t < 1 ? 5.8 * t * (1 - t) : 0;
}

export function jumpZone(speed) {
  return { near: speed * 0.28, far: speed * 0.62 };
}

export class Race {
  constructor(mode = "sprint") {
    this.reset(mode);
  }
  reset(mode = this.mode) {
    Object.assign(this, {
      mode,
      phase: "ready",
      previousPhase: null,
      distance: 0,
      speed: 0,
      time: 0,
      countdown: 3,
      strokes: 0,
      jumpAt: -10,
      jumps: 0,
      cleared: 0,
      hits: 0,
      perfects: 0,
      peakSpeed: 0,
      events: [],
      hurdles:
        mode === "hurdles"
          ? HURDLES.map((distance) => ({
              distance,
              state: "ahead",
              timing: "",
            }))
          : [],
    });
  }
  start() {
    if (this.phase === "ready") this.phase = "countdown";
  }
  pause() {
    if (!["running", "countdown"].includes(this.phase)) return;
    this.previousPhase = this.phase;
    this.phase = "paused";
  }
  resume() {
    if (this.phase === "paused") this.phase = this.previousPhase;
  }
  stroke(strength = 1) {
    if (this.phase !== "running") return false;
    this.speed = Math.min(
      11.8,
      this.speed + 2.15 * Math.max(0.5, Math.min(1.3, strength)),
    );
    this.strokes++;
    this.peakSpeed = Math.max(this.speed, this.peakSpeed);
    return true;
  }
  get height() {
    return jumpHeight(this.time - this.jumpAt);
  }
  get airborne() {
    return this.time - this.jumpAt < JUMP_DURATION;
  }
  get nextHurdle() {
    return this.hurdles.find((h) => h.state === "ahead");
  }
  get inJumpZone() {
    const next = this.nextHurdle;
    if (!next || this.speed < 0.4) return false;
    const d = next.distance - this.distance,
      zone = jumpZone(this.speed);
    return d >= zone.near && d <= zone.far;
  }
  jump() {
    if (this.phase !== "running" || this.mode !== "hurdles" || this.airborne)
      return false;
    this.jumpAt = this.time;
    this.jumps++;
    if (this.nextHurdle)
      this.nextHurdle.timing = this.inJumpZone ? "perfect" : "normal";
    this.events.push({ type: "jump" });
    return true;
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = "running";
        this.events.push({ type: "go" });
      }
      return;
    }
    if (this.phase !== "running") return;
    const from = this.distance;
    const previousTime = this.time;
    const drag = this.airborne ? 0.08 : 1.08;
    const nextSpeed = this.speed * Math.exp(-drag * dt);
    const travel = (this.speed + nextSpeed) * 0.5 * dt;
    this.speed = nextSpeed < 0.04 ? 0 : nextSpeed;
    this.time += dt;
    this.distance += travel;
    for (const hurdle of this.hurdles) {
      if (hurdle.state !== "ahead" || this.distance < hurdle.distance) continue;
      const fraction = Math.max(
        0,
        Math.min(1, (hurdle.distance - from) / Math.max(travel, 0.00001)),
      );
      const height = jumpHeight(previousTime + fraction * dt - this.jumpAt);
      if (height > 0.73) {
        hurdle.state = "clear";
        this.cleared++;
        if (hurdle.timing === "perfect") this.perfects++;
        this.events.push({
          type: "clear",
          perfect: hurdle.timing === "perfect",
        });
      } else {
        hurdle.state = "hit";
        this.hits++;
        this.speed *= 0.48;
        this.events.push({ type: "hit" });
      }
    }
    if (this.distance >= RACE_LENGTH) {
      const overshoot =
        (this.distance - RACE_LENGTH) / Math.max(travel, 0.00001);
      this.time -= dt * Math.min(1, overshoot);
      this.distance = RACE_LENGTH;
      this.phase = "finished";
      this.events.push({ type: "finish" });
    }
  }
  drainEvents() {
    return this.events.splice(0);
  }
}
