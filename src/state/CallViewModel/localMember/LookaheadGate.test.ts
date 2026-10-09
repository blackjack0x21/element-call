/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { HOLD_MS, LOOKAHEAD_MS, LookaheadGate } from "./LookaheadGate";

const SAMPLE_RATE = 48000;
const LOOKAHEAD = (LOOKAHEAD_MS / 1000) * SAMPLE_RATE;
const LOUD = 0.5;
const QUIET = 0.01;

describe("LookaheadGate", () => {
  it("sends silence while the input is below the threshold", () => {
    const output = run(gate(0.1), [[QUIET, 1000]]);
    expect(peak(output)).toBe(0);
  });

  it("sends the very start of a sudden sound at full volume", () => {
    const output = run(gate(0.1), [
      [0, 1000],
      [LOUD, 2 * LOOKAHEAD],
    ]);
    const onset = 1000 + LOOKAHEAD;
    expect(peak(output.subarray(0, onset))).toBe(0);
    expect(output[onset]).toBeGreaterThan(LOUD * 0.99);
  });

  it("delays the output by the lookahead", () => {
    const output = run(gate(0.001), [
      [LOUD, 1],
      [0, 1999],
    ]);
    expect(output.findIndex((sample) => sample !== 0)).toBe(LOOKAHEAD);
  });

  it("holds the gate open briefly after speech", () => {
    const speech = 0.2 * SAMPLE_RATE;
    const hold = (HOLD_MS / 1000) * SAMPLE_RATE;
    const output = run(gate(0.1), [
      [LOUD, speech],
      [QUIET, 2 * hold],
    ]);
    const afterSpeech = speech + LOOKAHEAD;
    expect(output[afterSpeech + hold / 2]).toBeCloseTo(QUIET, 3);
    expect(output[afterSpeech + 1.5 * hold]).toBeLessThan(QUIET / 100);
  });

  it("keeps the gate open for quieter sound once speech has started", () => {
    const output = run(gate(0.1, 0.05), [
      [LOUD, 1000],
      [0.08, SAMPLE_RATE],
    ]);
    expect(output[output.length - 1]).toBeCloseTo(0.08, 3);
  });

  it("needs the full threshold to open the gate", () => {
    const output = run(gate(0.1, 0.05), [[0.08, SAMPLE_RATE]]);
    expect(peak(output)).toBe(0);
  });
});

function gate(open: number, close = open): LookaheadGate {
  const gate = new LookaheadGate(SAMPLE_RATE);
  gate.openThreshold = open;
  gate.closeThreshold = close;
  return gate;
}

/** Feeds the gate stretches of constant volume, in render quanta as an AudioWorklet would. */
function run(
  gate: LookaheadGate,
  stretches: [volume: number, samples: number][],
): Float32Array {
  const input = Float32Array.from(
    stretches.flatMap(([volume, samples]) => Array(samples).fill(volume)),
  );
  const output = new Float32Array(input.length);
  for (let start = 0; start < input.length; start += 128) {
    const end = Math.min(start + 128, input.length);
    gate.process(input.subarray(start, end), output.subarray(start, end));
  }
  return output;
}

function peak(samples: Float32Array): number {
  return samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
}
