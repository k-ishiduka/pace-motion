import "./style.css";
import { Race } from "./race.js";
import { MotionInput } from "./motion.js";
import { CameraInput } from "./camera.js";
import { Stadium } from "./stadium.js";
import { GameAudio } from "./audio.js";

const $ = (id) => document.getElementById(id);
const show = (id, visible) => {
  $(id).hidden = !visible;
};
const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Private browsing can disable storage. */
    }
  },
};
const defaults = {
  sensitivity: 1,
  sound: false,
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
};
const saved = storage.get("pace-settings-v1", defaults);
const settings = {
  sensitivity: [0.8, 1, 1.4].includes(saved.sensitivity)
    ? saved.sensitivity
    : 1,
  sound: saved.sound === true,
  reduced: saved.reduced === true,
};
const race = new Race(),
  motion = new MotionInput(),
  sound = new GameAudio();
motion.setSensitivity(settings.sensitivity);
sound.enabled = settings.sound;
let stadium;
try {
  stadium = new Stadium($("stadium"));
} catch {
  $("fatal-error").textContent =
    "3D画面を表示できません。ブラウザのハードウェアアクセラレーションを有効にして、再読み込みしてください。";
  show("fatal-error", true);
  $("camera-start").disabled = true;
  $("keyboard-start").disabled = true;
}
let view = "home",
  input = "keyboard",
  lastSide = "",
  lastStrokeAt = -Infinity;
let lastValidPose = 0,
  tracking = { valid: false, ready: false },
  feedbackUntil = 0;
let previousCountdown = 0,
  startAt = 0,
  bestKey = "",
  cameraError = "";
const camera = new CameraInput($("camera-video"), {
  onPose: receivePose,
  onStatus: (message) => {
    $("setup-status").textContent = message;
    $("camera-status").textContent = message;
  },
  onError: (message) => {
    cameraError = message;
    tracking = { valid: false, ready: false };
    motion.reset();
    $("setup-status").textContent = message;
    $("camera-status").textContent = "カメラを使用できません";
    $("race-start").disabled = true;
    $("race-start").querySelector("span").textContent =
      "カメラを確認してください";
    show("camera-retry", true);
    if (view === "race") pause(message);
  },
});

const overlay = $("pose-overlay"),
  context = overlay.getContext("2d");
overlay.width = 640;
overlay.height = 480;
function receivePose(points, timestamp) {
  tracking = motion.update(points, timestamp);
  if (tracking.valid) lastValidPose = performance.now();
  if (view === "race" && input === "camera") {
    if (tracking.stroke) race.stroke(tracking.stroke);
    if (tracking.jump) race.jump();
  }
  context.clearRect(0, 0, 640, 480);
  if (points) {
    context.strokeStyle = tracking.valid ? "#ceffa4" : "#ffd09b";
    context.fillStyle = "#edffd4";
    context.lineWidth = 4;
    for (const [a, b] of [
      [11, 12],
      [11, 13],
      [13, 15],
      [12, 14],
      [14, 16],
      [11, 23],
      [12, 24],
      [23, 24],
    ]) {
      if (
        (points[a]?.visibility ?? 0) < 0.5 ||
        (points[b]?.visibility ?? 0) < 0.5
      )
        continue;
      context.beginPath();
      context.moveTo(points[a].x * 640, points[a].y * 480);
      context.lineTo(points[b].x * 640, points[b].y * 480);
      context.stroke();
    }
    for (const i of [11, 12, 13, 14, 15, 16])
      if ((points[i]?.visibility ?? 0) > 0.5) {
        context.beginPath();
        context.arc(points[i].x * 640, points[i].y * 480, 5, 0, Math.PI * 2);
        context.fill();
      }
  }
  $("camera-label").textContent = tracking.valid
    ? "MOTION CONNECTED"
    : "FINDING YOU";
  $("camera-status").textContent = tracking.valid
    ? tracking.raised
      ? "両手アップを認識！"
      : "腕を左右交互に振ってみよう"
    : "肩・ひじ・両手を映してください";
  if (view === "setup") {
    $("setup-status").textContent = tracking.ready
      ? "準備OK！ いつでもスタートできます"
      : tracking.valid
        ? "その位置で、少し待ってね"
        : "肩・ひじ・両手を枠の中に映してください";
    $("setup-dot").classList.toggle("ready", tracking.ready);
    $("readiness-progress").style.width =
      `${Math.min(100, motion.readyFor / 8)}%`;
    $("race-start").disabled = !tracking.ready;
    $("race-start").querySelector("span").textContent = tracking.ready
      ? "レースをはじめる"
      : "位置を確認中…";
  }
}

function setView(next) {
  view = next;
  show("home-panel", next === "home");
  show("setup-panel", next === "setup");
  show("result-panel", next === "result");
  show("race-hud", next === "race");
  show("pace-meter", next === "race");
  show("keyboard-controls", next === "race" && input === "keyboard");
  show(
    "camera-panel",
    input === "camera" && (next === "setup" || next === "race"),
  );
  $("game-shell").classList.toggle(
    "racing",
    next === "race" || next === "result",
  );
  if (next !== "race") {
    show("countdown", false);
    show("running-prompt", false);
    show("feedback", false);
    show("pause-overlay", false);
  }
}
function setMode(mode) {
  race.reset(mode);
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected);
  });
}
document
  .querySelectorAll("[data-mode]")
  .forEach((button) =>
    button.addEventListener("click", () => setMode(button.dataset.mode)),
  );

async function beginCamera() {
  input = "camera";
  cameraError = "";
  motion.reset();
  tracking = { valid: false, ready: false };
  race.reset();
  setView("setup");
  show("camera-retry", false);
  $("race-start").disabled = true;
  $("race-start").querySelector("span").textContent = "位置を確認中…";
  $("setup-dot").classList.remove("ready");
  $("readiness-progress").style.width = "0%";
  await camera.start();
}
function beginRace() {
  if (input === "camera" && (!tracking.ready || !camera.active)) return;
  sound.unlock();
  race.reset();
  motion.reset();
  lastSide = "";
  lastStrokeAt = -Infinity;
  previousCountdown = 0;
  startAt = performance.now();
  lastValidPose = startAt;
  bestKey = `pace-best-v1-${race.mode}-${input}-${input === "camera" ? settings.sensitivity : "keys"}`;
  race.start();
  setView("race");
  $("hud-event-name").textContent =
    race.mode === "sprint" ? "100m SPRINT" : "100m HURDLES";
  $("input-label").textContent =
    input === "camera" ? "CAMERA MODE" : "KEYBOARD / TOUCH";
  show("jump-button", race.mode === "hurdles");
  document.activeElement?.blur();
}
function beginKeyboard() {
  camera.stop();
  input = "keyboard";
  beginRace();
}
function goHome() {
  camera.stop();
  motion.reset();
  tracking = { valid: false, ready: false };
  race.reset();
  setView("home");
  $("camera-start").focus({ preventScroll: true });
}
function pause(reason = "準備ができたら、続きを走ろう。") {
  race.pause();
  if (race.phase !== "paused") return;
  $("pause-reason").textContent = reason;
  show("pause-overlay", true);
  $("resume-button").focus({ preventScroll: true });
}
function resume() {
  if (
    input === "camera" &&
    (!camera.active ||
      !tracking.ready ||
      performance.now() - lastValidPose > 700)
  )
    return;
  sound.unlock();
  race.resume();
  show("pause-overlay", false);
  lastSide = "";
  lastStrokeAt = -Infinity;
  document.activeElement?.blur();
}
function keyboardStroke(side) {
  if (input !== "keyboard" || view !== "race" || race.phase !== "running")
    return;
  const time = performance.now();
  if (side === lastSide || time - lastStrokeAt < 80) return;
  if (race.stroke(1)) {
    lastSide = side;
    lastStrokeAt = time;
  }
}
function jump() {
  if (input === "keyboard" && view === "race") race.jump();
}
$("camera-start").addEventListener("click", beginCamera);
$("camera-retry").addEventListener("click", beginCamera);
$("keyboard-start").addEventListener("click", beginKeyboard);
$("setup-keyboard").addEventListener("click", beginKeyboard);
$("race-start").addEventListener("click", beginRace);
$("setup-back").addEventListener("click", goHome);
$("camera-stop").addEventListener("click", goHome);
$("pause-home").addEventListener("click", goHome);
$("home-button").addEventListener("click", goHome);
$("pause-button").addEventListener("click", () => pause());
$("resume-button").addEventListener("click", resume);
$("retry-button").addEventListener("click", () =>
  input === "camera" ? beginCamera() : beginKeyboard(),
);
$("left-stroke").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  keyboardStroke("left");
});
$("right-stroke").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  keyboardStroke("right");
});
$("jump-button").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  jump();
});
// Click events from assistive technology and keyboard focus remain usable.
$("left-stroke").addEventListener("click", (event) => {
  if (event.detail === 0) keyboardStroke("left");
});
$("right-stroke").addEventListener("click", (event) => {
  if (event.detail === 0) keyboardStroke("right");
});
$("jump-button").addEventListener("click", (event) => {
  if (event.detail === 0) jump();
});
document.addEventListener("keydown", (event) => {
  if (event.repeat || document.querySelector("dialog[open]")) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
  if (event.code === "Escape" && view === "race") {
    event.preventDefault();
    race.phase === "paused" ? resume() : pause();
    return;
  }
  if (view !== "race" || input !== "keyboard") return;
  if (
    ["ArrowLeft", "KeyA", "ArrowRight", "KeyD", "Space"].includes(event.code)
  ) {
    event.preventDefault();
    if (event.code === "Space") jump();
    else
      keyboardStroke(
        ["ArrowLeft", "KeyA"].includes(event.code) ? "left" : "right",
      );
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause("画面を離れたため、一時停止しました。");
});
window.addEventListener("pagehide", () => camera.stop());
for (const name of ["help", "settings"]) {
  const dialog = $(`${name}-dialog`);
  $(`${name}-button`).addEventListener("click", () => {
    if (view === "race") pause();
    dialog.showModal();
  });
  dialog
    .querySelector(".modal-close")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  });
}
$("sensitivity").value = String(settings.sensitivity);
$("sound").checked = settings.sound;
$("reduce-motion").checked = settings.reduced;
$("sensitivity").addEventListener("change", (event) => {
  settings.sensitivity = Number(event.target.value);
  motion.setSensitivity(settings.sensitivity);
  motion.reset();
  // A sensitivity change during a race makes this a practice run rather than a personal best.
  if (view === "race") bestKey = "";
  storage.set("pace-settings-v1", settings);
});
$("sound").addEventListener("change", (event) => {
  settings.sound = event.target.checked;
  sound.enabled = settings.sound;
  sound.unlock();
  sound.play("clear");
  storage.set("pace-settings-v1", settings);
});
$("reduce-motion").addEventListener("change", (event) => {
  settings.reduced = event.target.checked;
  storage.set("pace-settings-v1", settings);
});
$("fullscreen-button").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("game-shell").requestFullscreen();
  } catch {
    /* Some mobile browsers do not expose fullscreen. */
  }
});
if (!$("game-shell").requestFullscreen) show("fullscreen-button", false);
document.addEventListener("fullscreenchange", () =>
  $("fullscreen-button").setAttribute(
    "aria-label",
    document.fullscreenElement ? "全画面を終了" : "全画面表示",
  ),
);

function finish() {
  const previousBest = bestKey ? storage.get(bestKey, null) : null;
  const newBest =
    !!bestKey && (typeof previousBest !== "number" || race.time < previousBest);
  if (newBest) storage.set(bestKey, race.time);
  $("result-time").textContent = race.time.toFixed(2);
  $("result-strokes").textContent = race.strokes;
  $("result-stat-label").textContent =
    race.mode === "hurdles" ? "ハードル成功" : "最高速度";
  $("result-stat").textContent =
    race.mode === "hurdles"
      ? `${race.cleared} / 8`
      : `${(race.peakSpeed * 3.6).toFixed(1)} km/h`;
  $("result-best").textContent = bestKey
    ? `${(newBest ? race.time : previousBest).toFixed(2)} s`
    : "練習記録";
  $("result-message").textContent =
    race.mode === "hurdles"
      ? `${race.perfects}回のPERFECT！ ${input === "camera" ? "あなたの動きで" : "キー・タッチ操作で"}走りきった100m。`
      : `${input === "camera" ? "あなたの腕で" : "キー・タッチ操作で"}走りきった100m。ナイスラン！`;
  show("new-best", newBest);
  setView("result");
  camera.stop();
  $("retry-button").focus({ preventScroll: true });
}
function showFeedback(text, hit = false) {
  $("feedback").textContent = text;
  $("feedback").classList.toggle("hit", hit);
  feedbackUntil = performance.now() + 1050;
  show("feedback", true);
}
function events() {
  for (const event of race.drainEvents()) {
    sound.play(event.type);
    if (event.type === "clear")
      showFeedback(event.perfect ? "PERFECT!" : "NICE JUMP!");
    if (event.type === "hit") showFeedback("KEEP GOING!", true);
    if (event.type === "go") startAt = performance.now();
    if (event.type === "finish") finish();
  }
}
const bars = [];
for (let i = 0; i < 14; i++) {
  const bar = document.createElement("i");
  $("pace-meter").querySelector(".pace-bars").append(bar);
  bars.push(bar);
}
function updateUI(now) {
  if (view !== "race") return;
  $("distance").innerHTML = `${race.distance.toFixed(1)}<small>m</small>`;
  $("timer").innerHTML = `${race.time.toFixed(2)}<small>s</small>`;
  $("speed").innerHTML = `${(race.speed * 3.6).toFixed(1)} <small>km/h</small>`;
  $("stroke-count").textContent = `${race.strokes} SWINGS`;
  $("race-progress-fill").style.width = `${race.distance}%`;
  bars.forEach((bar, i) =>
    bar.classList.toggle("on", i / 14 < race.speed / 11.8),
  );
  if (now > feedbackUntil) show("feedback", false);
  const counting = race.phase === "countdown";
  const justStarted = race.phase === "running" && now - startAt < 650;
  show("countdown", counting || justStarted);
  if (counting) {
    const count = Math.max(1, Math.ceil(race.countdown));
    $("countdown-number").textContent = count;
    $("countdown-label").textContent =
      count === 3
        ? "位置について"
        : count === 2
          ? "準備はいい？"
          : "さあ、腕を振ろう";
    if (count !== previousCountdown) {
      sound.play("tick");
      previousCountdown = count;
    }
  } else if (justStarted) {
    $("countdown-number").textContent = "GO";
    $("countdown-label").textContent = "自分のペースで、100mへ。";
  }
  show("running-prompt", race.phase === "running" && !justStarted);
  $("running-prompt").classList.toggle(
    "jump-now",
    race.inJumpZone && !race.airborne,
  );
  if (race.inJumpZone && !race.airborne) {
    $("prompt-eyebrow").textContent = "JUMP ZONE";
    $("prompt-text").textContent =
      input === "camera" ? "いま！ 両手を上げて" : "いま！ SPACEでジャンプ";
    $("prompt-detail").textContent = "緑に光る地面がタイミングの合図";
  } else if (race.airborne) {
    $("prompt-eyebrow").textContent = "FLY OVER";
    $("prompt-text").textContent = "その調子！";
    $("prompt-detail").textContent =
      input === "camera"
        ? "両手を下ろして、また腕を振ろう"
        : "左右交互に押して、加速しよう";
  } else {
    $("prompt-eyebrow").textContent =
      race.distance > 80 ? "FINAL STRETCH" : "FIND YOUR RHYTHM";
    $("prompt-text").textContent =
      race.distance > 80
        ? "あと少し、ゴールへ！"
        : input === "camera"
          ? "腕を交互に振ろう"
          : "← → を交互に押そう";
    $("prompt-detail").textContent = race.nextHurdle
      ? `次のハードルまで ${Math.max(0, race.nextHurdle.distance - race.distance).toFixed(1)} m`
      : "動いた分だけ、前へ。";
  }
  if (input === "camera") {
    const missing = !camera.active || now - lastValidPose > 800;
    if (missing && ["running", "countdown"].includes(race.phase))
      pause(
        cameraError ||
          "体が見えなくなりました。肩・ひじ・両手をカメラに映すと再開できます。",
      );
    $("resume-button").disabled = missing || !tracking.ready;
    $("resume-button").textContent =
      missing || !tracking.ready
        ? "カメラに上半身を映してください"
        : "レースに戻る";
  } else {
    $("resume-button").disabled = false;
    $("resume-button").textContent = "レースに戻る";
  }
}
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  race.update(dt);
  events();
  updateUI(now);
  stadium?.render(race, dt, now / 1000, settings.reduced);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
