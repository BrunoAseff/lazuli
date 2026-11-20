/*
 * The level-up sounds, synthesised with Web Audio (no files to load): three soft chisel taps that
 * climb in pitch, then a two-note bell when the stone takes its new cut. Quiet by design, and off
 * when the person turned sounds off.
 */

const SOUND_KEY = "lazuli:sounds";

export const soundsEnabled = () => {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSoundsEnabled = (enabled: boolean) => {
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  } catch {
    // Without storage the choice lasts only for this page.
  }
};

let context: AudioContext | null = null;
const audio = () => {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
};

/** One voice: a quick attack and an exponential fade, like a struck object. */
const voice = (
  frequency: number,
  {
    at = 0,
    decay,
    peak,
    type = "sine",
  }: { at?: number; decay: number; peak: number; type?: OscillatorType },
) => {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + at;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + decay + 0.05);
};

/** A chisel tap; `step` 0–2 climbs in pitch. */
export const playTap = (step: number) => {
  if (!soundsEnabled()) return;
  const base = [1046.5, 1174.66, 1318.51][step] ?? 1318.51;
  voice(base, { decay: 0.12, peak: 0.05, type: "triangle" });
  voice(base * 2.76, { decay: 0.05, peak: 0.012 });
};

/** The new cut: a bell on E and B, with a faint octave above for shimmer. */
export const playChime = () => {
  if (!soundsEnabled()) return;
  voice(659.25, { decay: 1.1, peak: 0.11 });
  voice(659.25 * 2.01, { decay: 0.6, peak: 0.02 });
  voice(987.77, { at: 0.11, decay: 1.4, peak: 0.1 });
  voice(1318.51, { at: 0.22, decay: 1.6, peak: 0.035 });
};
