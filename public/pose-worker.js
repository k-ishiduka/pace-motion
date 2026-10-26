/* Pose inference stays off the rendering thread. All assets are served by this site. */
let detector;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts(new URL('vision/vision_bundle.js', data.base).href);
      const vision = await Vision.FilesetResolver.forVisionTasks(new URL('wasm/', data.base).href);
      detector = await Vision.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: new URL('models/pose_landmarker_lite.task', data.base).href, delegate: 'CPU' },
        canvas: new OffscreenCanvas(640, 480), runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.55, minPosePresenceConfidence: 0.55, minTrackingConfidence: 0.55,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
  }
  if (data.type === 'frame') {
    try {
      const result = detector.detectForVideo(data.frame, data.time);
      self.postMessage({ type: 'pose', points: result.landmarks[0] || null, time: data.time });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
    finally { data.frame.close(); }
  }
};
