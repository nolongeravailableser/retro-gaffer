/**
 * Retro sound — 8-bit style cues synthesized with WebAudio oscillators.
 * No audio assets, no dependencies; a few square/saw blips with envelopes.
 *
 * The mute preference is a DEVICE setting (localStorage, not the game save):
 * it shouldn't travel inside save codes between devices.
 *
 * Purely presentational — never touches game logic or determinism.
 */

export type SoundCue =
  | 'kickoff'
  | 'goal'
  | 'chance'
  | 'yellow'
  | 'red'
  | 'injury'
  | 'whistle';

const MUTE_KEY = 'gaffer-muted';

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* private mode — session-only silence */
  }
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  // Match playback always starts from a click, so resume() is permitted.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** One enveloped note. Times are relative to "now" in seconds. */
function tone(
  c: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'square',
  peak = 0.05
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const t0 = c.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Fire a cue (no-op when muted or WebAudio is unavailable). */
export function playCue(cue: SoundCue): void {
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  switch (cue) {
    case 'kickoff':
      tone(c, 1568, 0, 0.09);
      break;
    case 'goal':
      // Rising 8-bit fanfare.
      tone(c, 523, 0, 0.09);
      tone(c, 659, 0.09, 0.09);
      tone(c, 784, 0.18, 0.1);
      tone(c, 1047, 0.28, 0.22, 'square', 0.06);
      break;
    case 'chance':
      tone(c, 740, 0, 0.05, 'square', 0.025);
      break;
    case 'yellow':
      tone(c, 220, 0, 0.14, 'sawtooth', 0.04);
      break;
    case 'red':
      tone(c, 180, 0, 0.16, 'sawtooth', 0.05);
      tone(c, 120, 0.16, 0.26, 'sawtooth', 0.05);
      break;
    case 'injury':
      tone(c, 392, 0, 0.12, 'triangle', 0.05);
      tone(c, 262, 0.12, 0.2, 'triangle', 0.05);
      break;
    case 'whistle':
      // Peep — peep — peeeep.
      tone(c, 1865, 0, 0.09, 'square', 0.045);
      tone(c, 1865, 0.14, 0.09, 'square', 0.045);
      tone(c, 1865, 0.28, 0.3, 'square', 0.05);
      break;
  }
}
