import { test } from "node:test";
import assert from "node:assert/strict";
import { Race, jumpHeight, JUMP_DURATION } from "../src/race.js";

function advance(race, seconds) {
  for (let i = 0; i < seconds * 120; i++) race.update(1 / 120);
}
function start(mode = "sprint") {
  const race = new Race(mode);
  race.start();
  advance(race, 3.1);
  race.drainEvents();
  return race;
}

test("a race never moves by itself; the countdown rejects input", () => {
  const race = new Race();
  race.start();
  assert.equal(race.stroke(), false);
  assert.equal(race.jump(), false);
  advance(race, 8);
  assert.equal(race.distance, 0);
  assert.equal(race.phase, "running");
});
test("alternating input adds speed, and stopping input decelerates to rest", () => {
  const race = start();
  for (let i = 0; i < 10; i++) {
    race.stroke();
    advance(race, 0.2);
  }
  assert.ok(race.distance > 5);
  assert.ok(race.speed > 6);
  const speed = race.speed;
  advance(race, 1);
  assert.ok(race.speed < speed * 0.4);
  advance(race, 8);
  assert.equal(race.speed, 0);
});
test("pausing freezes both clock and distance and rejects movement", () => {
  const race = start();
  race.stroke();
  advance(race, 0.2);
  race.pause();
  const snapshot = [race.time, race.distance, race.speed];
  advance(race, 2);
  assert.deepEqual([race.time, race.distance, race.speed], snapshot);
  assert.equal(race.stroke(), false);
  race.resume();
  advance(race, 0.2);
  assert.ok(race.distance > snapshot[1]);
});
test("sprint finishes at exactly 100 m and resets cleanly", () => {
  const race = start();
  for (let i = 0; i < 200 && race.phase !== "finished"; i++) {
    race.stroke();
    advance(race, 0.2);
  }
  assert.equal(race.phase, "finished");
  assert.equal(race.distance, 100);
  assert.ok(race.time > 8);
  assert.equal(race.drainEvents().filter((e) => e.type === "finish").length, 1);
  race.reset("hurdles");
  assert.equal(race.distance, 0);
  assert.equal(race.time, 0);
  assert.equal(race.strokes, 0);
  assert.equal(race.hurdles.length, 8);
});
test("no jump hits a hurdle once and reduces speed", () => {
  const race = start("hurdles");
  race.distance = 15.99;
  race.speed = 8;
  advance(race, 0.02);
  assert.equal(race.hits, 1);
  assert.ok(race.speed < 4);
  advance(race, 0.2);
  assert.equal(race.hits, 1);
});
test("jumping in the lit window clears hurdles at slow and fast speeds", () => {
  for (const speed of [0.5, 2, 4, 7, 10, 11.8]) {
    const race = start("hurdles");
    race.speed = speed;
    race.distance = 16 - speed * 0.46;
    assert.equal(race.inJumpZone, true);
    assert.equal(race.jump(), true);
    assert.equal(race.jump(), false);
    advance(race, 0.65);
    assert.equal(race.cleared, 1, `clear at ${speed}`);
    assert.equal(race.hits, 0);
    assert.equal(race.perfects, 1);
  }
});
test("too-early and late jumps do not bypass collision", () => {
  for (const lead of [0.1, 14]) {
    const race = start("hurdles");
    race.speed = 8;
    race.distance = 16 - lead;
    race.jump();
    for (let i = 0; i < 8; i++) {
      race.stroke();
      advance(race, 0.2);
    }
    assert.equal(race.hurdles[0].state, "hit");
  }
});
test("jump height is zero outside the flight and safe at its apex", () => {
  assert.equal(jumpHeight(-0.1), 0);
  assert.equal(jumpHeight(0), 0);
  assert.equal(jumpHeight(JUMP_DURATION), 0);
  assert.ok(jumpHeight(JUMP_DURATION / 2) > 1.4);
});
test("all eight hurdles can be cleared in a full race with the visible cue", () => {
  const race = start("hurdles");
  let strokes = 0;
  for (let i = 0; i < 10000 && race.phase !== "finished"; i++) {
    if (i % 24 === 0) {
      race.stroke();
      strokes++;
    }
    const next = race.nextHurdle;
    if (
      next &&
      next.distance - race.distance < race.speed * 0.48 &&
      race.inJumpZone
    )
      race.jump();
    race.update(1 / 120);
  }
  assert.equal(race.phase, "finished");
  assert.equal(race.cleared, 8);
  assert.equal(race.hits, 0);
  assert.equal(race.perfects, 8);
  assert.ok(strokes > 20);
});
