import { test } from "node:test";
import assert from "node:assert/strict";
import { MotionInput } from "../src/motion.js";

function pose(left = 0.63, right = 0.63, translate = 0) {
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5 + translate,
    z: 0,
    visibility: 0.99,
  }));
  points[11] = { x: 0.35, y: 0.4 + translate, visibility: 0.99 };
  points[12] = { x: 0.65, y: 0.4 + translate, visibility: 0.99 };
  points[15] = { x: 0.32, y: left + translate, visibility: 0.99 };
  points[16] = { x: 0.68, y: right + translate, visibility: 0.99 };
  return points;
}
test("standing still and small camera jitter do not generate strokes", () => {
  const motion = new MotionInput();
  let strokes = 0;
  for (let i = 0; i < 180; i++)
    strokes += motion.update(
      pose(0.63 + Math.sin(i) * 0.01, 0.63),
      i * 33,
    ).stroke;
  assert.equal(strokes, 0);
  assert.equal(motion.valid, true);
  assert.ok(motion.readyFor > 800);
});
test("whole-body translation is rejected", () => {
  const motion = new MotionInput();
  let strokes = 0;
  for (let i = 0; i < 180; i++)
    strokes += motion.update(
      pose(0.7, 0.5, Math.sin(i / 5) * 0.1),
      i * 33,
    ).stroke;
  assert.equal(strokes, 0);
});
test("running arm swings produce repeated alternating input", () => {
  const motion = new MotionInput();
  let count = 0;
  for (let i = 0; i < 180; i++) {
    const s = Math.sin(i * 0.42) * 0.15;
    if (motion.update(pose(0.63 + s, 0.63 - s), i * 33).stroke) count++;
  }
  assert.ok(count >= 18 && count <= 26, `strokes=${count}`);
});
test("both hands raised produce one jump, only rearm after lowering", () => {
  const motion = new MotionInput();
  let jumps = 0,
    strokes = 0;
  for (let i = 0; i < 120; i++) {
    const y = i < 40 || i >= 60 ? 0.2 : 0.63;
    const output = motion.update(pose(y, y), i * 33);
    if (output.jump) jumps++;
    strokes += output.stroke;
  }
  assert.equal(jumps, 2);
  assert.equal(strokes, 0);
});
test("one hand and brief overhead noise cannot jump", () => {
  const motion = new MotionInput();
  let jumps = 0;
  for (let i = 0; i < 30; i++)
    if (motion.update(pose(0.2, i === 10 ? 0.2 : 0.6), i * 33).jump) jumps++;
  assert.equal(jumps, 0);
});
test("tracking loss resets calibration and does not cause a stroke on return", () => {
  const motion = new MotionInput();
  motion.update(pose(0.8, 0.5), 0);
  assert.equal(motion.update(null, 33).valid, false);
  assert.equal(motion.update(pose(0.5, 0.8), 66).stroke, 0);
  assert.equal(motion.readyFor, 0);
  const bad = pose();
  bad[15].visibility = 0.1;
  assert.equal(motion.update(bad, 100).valid, false);
});
test("stale frame gaps rebaseline rather than award phantom motion", () => {
  const motion = new MotionInput();
  motion.update(pose(0.8, 0.5), 0);
  assert.equal(motion.update(pose(0.5, 0.8), 1000).stroke, 0);
});
