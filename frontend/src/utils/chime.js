// Friendly two-note ascending chime via Web Audio. Used when something
// notable happens on a real-time page (new booking arrives, status flips).
// Silent-fails on browsers without Web Audio or where autoplay policy
// blocks it — the visual toast still fires, so no information is lost.
export function playChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const note = (freq, offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    };
    note(659.25, 0);    // E5
    note(987.77, 0.18); // B5
  } catch {
    // best-effort
  }
}
