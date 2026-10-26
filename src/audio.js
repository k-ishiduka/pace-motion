export class GameAudio {
  enabled = false;
  context = null;
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }
  play(type) {
    if (!this.enabled || !this.context) return;
    const notes = {
      tick: [440],
      go: [880],
      jump: [500, 750],
      clear: [660, 880],
      hit: [130],
      finish: [523, 659, 784, 1047],
    }[type];
    if (!notes) return;
    notes.forEach((frequency, i) => {
      const oscillator = this.context.createOscillator(),
        gain = this.context.createGain();
      const time = this.context.currentTime + i * 0.1;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.09, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(time);
      oscillator.stop(time + 0.21);
    });
  }
}
