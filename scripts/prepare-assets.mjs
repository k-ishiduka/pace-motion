import { cp, mkdir, stat, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/wasm/", root), { recursive: true });
await cp(
  new URL("node_modules/@mediapipe/tasks-vision/wasm/", root),
  new URL("public/wasm/", root),
  { recursive: true },
);
await mkdir(new URL("public/vision/", root), { recursive: true });
await cp(
  new URL("node_modules/@mediapipe/tasks-vision/vision_bundle.js", root),
  new URL("public/vision/vision_bundle.js", root),
);
const model = new URL("public/models/pose_landmarker_lite.task", root);
try {
  await stat(model);
} catch {
  console.log("Downloading the official MediaPipe Pose Landmarker Lite model…");
  const url =
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  await mkdir(new URL("public/models/", root), { recursive: true });
  await writeFile(
    fileURLToPath(model),
    new Uint8Array(await response.arrayBuffer()),
  );
}
const expected =
  "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a";
if (
  createHash("sha256")
    .update(await readFile(model))
    .digest("hex") !== expected
) {
  throw new Error(
    "Pose model checksum mismatch. Restore public/models/pose_landmarker_lite.task.",
  );
}
