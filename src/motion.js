// Shoulder-relative, alternating wrist motion rejects camera translation and small jitter.
export class MotionInput {
  constructor() {
    this.sensitivity = 1;
    this.reset();
  }
  reset() {
    this.signal = 0;
    this.lastSide = 0;
    this.lastStroke = -Infinity;
    this.previousTime = null;
    this.raisedSince = null;
    this.raiseLatched = false;
    this.valid = false;
    this.energy = 0;
    this.readyFor = 0;
  }
  setSensitivity(value) {
    this.sensitivity = value;
  }
  update(points, time) {
    const result = {
      valid: false,
      stroke: 0,
      jump: false,
      raised: false,
      energy: 0,
      ready: false,
    };
    const required = [11, 12, 13, 14, 15, 16];
    const visible =
      points &&
      required.every(
        (i) =>
          points[i] &&
          (points[i].visibility ?? 1) > 0.55 &&
          points[i].x > 0.01 &&
          points[i].x < 0.99 &&
          points[i].y > 0.01 &&
          points[i].y < 0.99,
      );
    if (!visible) {
      this.reset();
      return result;
    }
    const [ls, rs, lw, rw] = [points[11], points[12], points[15], points[16]];
    const span = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (span < 0.08 || span > 0.8) {
      this.reset();
      return result;
    }
    const raw = (lw.y - ls.y - (rw.y - rs.y)) / span;
    const fresh = this.previousTime === null || time - this.previousTime > 300;
    const dt = fresh ? 0 : Math.max(0, Math.min(100, time - this.previousTime));
    this.previousTime = time;
    this.valid = true;
    this.readyFor = fresh ? 0 : this.readyFor + dt;
    this.signal = fresh
      ? raw
      : this.signal + (raw - this.signal) * (1 - Math.exp(-dt / 65));
    const raised = lw.y < ls.y - span * 0.2 && rw.y < rs.y - span * 0.2;
    const lowered = lw.y > ls.y - span * 0.04 && rw.y > rs.y - span * 0.04;
    if (lowered) {
      this.raiseLatched = false;
      this.raisedSince = null;
    }
    if (raised) {
      if (this.raisedSince === null) this.raisedSince = time;
      if (!this.raiseLatched && time - this.raisedSince >= 110) {
        result.jump = true;
        this.raiseLatched = true;
      }
    } else this.raisedSince = null;
    const threshold = 0.26 / this.sensitivity;
    const side =
      this.signal > threshold ? 1 : this.signal < -threshold ? -1 : 0;
    if (fresh) this.lastSide = side;
    // Hands overhead are a jump gesture, not a running stroke.
    if (
      !fresh &&
      !raised &&
      !this.raiseLatched &&
      side &&
      side !== this.lastSide &&
      time - this.lastStroke > 135
    ) {
      if (this.lastSide !== 0) {
        result.stroke = Math.max(
          0.65,
          Math.min(1.3, Math.abs(this.signal) * this.sensitivity * 1.4),
        );
        this.lastStroke = time;
      }
      this.lastSide = side;
    }
    this.energy = Math.max(result.stroke, this.energy * Math.exp(-dt / 250));
    return {
      ...result,
      valid: true,
      raised,
      energy: this.energy,
      ready: this.readyFor >= 800,
    };
  }
}
