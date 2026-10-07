/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// Runs on the audio thread, inside an AudioWorklet: imports nothing, so that
// its bundle doesn't drag main-thread code in with it.

export const VOICE_GATE_PROCESSOR = "element-call-voice-gate";

/** How far the output trails the input, so the gate opens before a word's first sound is sent. */
export const LOOKAHEAD_MS = 30;
/** Keeps the gate open after speech, so trailing sounds aren't chopped off. */
export const HOLD_MS = 500;
// Short enough to catch a plosive, which is over within a few milliseconds.
const DETECTION_MS = 5;
const ATTACK_MS = 2;
const RELEASE_MS = 30;

/**
 * A noise gate that delays its output by {@link LOOKAHEAD_MS}, deciding
 * whether to open from the undelayed input.
 */
export class LookaheadGate {
  /** The RMS volume, from 0 to 1, that speech must reach to open the gate. */
  public openThreshold = 0;
  /** The RMS volume that keeps an open gate open, at most {@link openThreshold}. */
  public closeThreshold = 0;

  private readonly delayLine: Float32Array;
  private delayIndex = 0;
  private meanSquare = 0;
  private samplesSinceLoud = Infinity;
  private gain = 0;

  private readonly holdSamples: number;
  private readonly detectionCoefficient: number;
  private readonly attackCoefficient: number;
  private readonly releaseCoefficient: number;

  public constructor(sampleRate: number) {
    this.delayLine = new Float32Array(
      Math.round((LOOKAHEAD_MS / 1000) * sampleRate),
    );
    this.holdSamples = (HOLD_MS / 1000) * sampleRate;
    this.detectionCoefficient = smoothingCoefficient(DETECTION_MS, sampleRate);
    this.attackCoefficient = smoothingCoefficient(ATTACK_MS, sampleRate);
    this.releaseCoefficient = smoothingCoefficient(RELEASE_MS, sampleRate);
  }

  public process(input: Float32Array, output: Float32Array): void {
    for (let i = 0; i < output.length; i++) {
      const sample = input[i] ?? 0;
      this.meanSquare +=
        (sample * sample - this.meanSquare) * this.detectionCoefficient;
      const open = this.samplesSinceLoud <= this.holdSamples;
      const threshold = open ? this.closeThreshold : this.openThreshold;
      if (Math.sqrt(this.meanSquare) >= threshold) this.samplesSinceLoud = 0;
      else this.samplesSinceLoud++;

      const target = this.samplesSinceLoud <= this.holdSamples ? 1 : 0;
      this.gain +=
        (target - this.gain) *
        (target > this.gain ? this.attackCoefficient : this.releaseCoefficient);

      output[i] = this.delayed(sample) * this.gain;
    }
  }

  private delayed(sample: number): number {
    if (this.delayLine.length === 0) return sample;
    const out = this.delayLine[this.delayIndex];
    this.delayLine[this.delayIndex] = sample;
    this.delayIndex = (this.delayIndex + 1) % this.delayLine.length;
    return out;
  }
}

/** The per-sample step of a one-pole filter with the given time constant. */
function smoothingCoefficient(
  timeConstantMs: number,
  sampleRate: number,
): number {
  return 1 - Math.exp(-1000 / (timeConstantMs * sampleRate));
}
