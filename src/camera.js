export function cameraErrorMessage(error) {
  if (
    error?.name === "NotAllowedError" ||
    error?.name === "PermissionDeniedError"
  )
    return "カメラが許可されていません。ブラウザのサイト設定でカメラを許可して、再接続してください。";
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError")
    return "カメラが見つかりません。カメラを接続するか、キー操作で遊べます。";
  if (error?.name === "NotReadableError")
    return "カメラを使用できません。他のアプリで使っている場合は閉じてから、再接続してください。";
  return "カメラ認識を読み込めませんでした。接続を確認して再接続するか、キー操作で遊べます。";
}

export class CameraInput {
  constructor(video, { onPose, onStatus, onError }) {
    Object.assign(this, {
      video,
      onPose,
      onStatus,
      onError,
      generation: 0,
      active: false,
      stream: null,
      worker: null,
      detector: null,
      busy: false,
      lastFrame: 0,
      lastVideoTime: -1,
      frameHandle: 0,
    });
  }
  async start() {
    this.stop();
    const generation = this.generation;
    const current = () => this.generation === generation;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error("secure-context");
      this.onStatus("カメラの使用を許可してください");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (current())
          this.fail(
            "カメラとの接続が切れました。ホームに戻って再接続してください。",
          );
      });
      await this.video.play();
      if (!current()) return;
      this.onStatus("カメラ認識を準備中… 初回は少し時間がかかります");
      const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
      try {
        if (!window.OffscreenCanvas || !window.createImageBitmap)
          throw new Error("worker unsupported");
        const worker = new Worker(new URL("pose-worker.js", base));
        this.worker = worker;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("worker timeout")),
            25000,
          );
          worker.onmessage = ({ data }) => {
            if (data.type === "ready") {
              clearTimeout(timeout);
              resolve();
            }
            if (data.type === "error") {
              clearTimeout(timeout);
              reject(new Error(data.message));
            }
          };
          worker.onerror = (error) => {
            clearTimeout(timeout);
            reject(error);
          };
          worker.postMessage({ type: "init", base });
        });
        if (!current()) {
          worker.terminate();
          return;
        }
        worker.onmessage = ({ data }) => {
          if (!current()) return;
          this.busy = false;
          if (data.type === "pose") this.onPose(data.points, data.time);
          if (data.type === "error")
            this.fail(
              "カメラ認識が停止しました。ホームに戻って再接続してください。",
            );
        };
        worker.onerror = () => {
          if (current())
            this.fail("カメラ認識が停止しました。再接続してください。");
        };
      } catch {
        if (!current()) return;
        this.worker?.terminate();
        this.worker = null;
        const { FilesetResolver, PoseLandmarker } =
          await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(
          new URL("wasm/", base).href,
        );
        const detector = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: new URL("models/pose_landmarker_lite.task", base)
              .href,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.55,
          minPosePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
        if (!current()) {
          detector.close();
          return;
        }
        this.detector = detector;
      }
      if (!current()) return;
      this.active = true;
      this.onStatus("肩・ひじ・両手を枠の中に映してください");
      this.loop();
    } catch (error) {
      if (!current()) return;
      const message =
        error?.message === "secure-context"
          ? "カメラにはHTTPSのURLが必要です。公開URLから開くか、キー操作で遊んでください。"
          : cameraErrorMessage(error);
      this.fail(message);
    }
  }
  fail(message) {
    this.stop();
    this.onError(message);
  }
  loop = async () => {
    if (!this.active) return;
    this.frameHandle = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (
      document.hidden ||
      this.busy ||
      now - this.lastFrame < 50 ||
      this.video.readyState < 2 ||
      this.video.currentTime === this.lastVideoTime
    )
      return;
    this.lastFrame = now;
    this.lastVideoTime = this.video.currentTime;
    this.busy = true;
    const generation = this.generation;
    try {
      if (this.worker) {
        const frame = await createImageBitmap(this.video);
        if (generation !== this.generation || !this.worker) {
          frame.close();
          return;
        }
        this.worker.postMessage({ type: "frame", frame, time: now }, [frame]);
      } else {
        const result = this.detector.detectForVideo(this.video, now);
        this.onPose(result.landmarks[0] || null, now);
        this.busy = false;
      }
    } catch {
      if (generation === this.generation)
        this.fail(
          "映像を読み取れませんでした。ホームに戻って再接続してください。",
        );
    }
  };
  stop() {
    this.generation++;
    this.active = false;
    cancelAnimationFrame(this.frameHandle);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.worker?.terminate();
    this.worker = null;
    this.detector?.close();
    this.detector = null;
    this.busy = false;
    this.lastVideoTime = -1;
  }
}
