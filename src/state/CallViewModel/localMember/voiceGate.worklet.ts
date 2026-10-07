/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { LookaheadGate, VOICE_GATE_PROCESSOR } from "./LookaheadGate.ts";

// The AudioWorklet global scope, which TypeScript's DOM library doesn't describe.
declare const sampleRate: number;
declare class AudioWorkletProcessor {}
declare function registerProcessor(
  name: string,
  processor: new () => AudioWorkletProcessor,
): void;

class VoiceGateProcessor extends AudioWorkletProcessor {
  public static readonly parameterDescriptors = ["open", "close"].map(
    (name) => ({ name, defaultValue: 0, minValue: 0, maxValue: 1 }),
  );

  private readonly gate = new LookaheadGate(sampleRate);

  public process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    this.gate.openThreshold = parameters.open[0];
    this.gate.closeThreshold = parameters.close[0];
    // Mono in and out, as set up by the node's channel options.
    const output = outputs[0][0];
    this.gate.process(inputs[0][0] ?? new Float32Array(output.length), output);
    return true;
  }
}

registerProcessor(VOICE_GATE_PROCESSOR, VoiceGateProcessor);
