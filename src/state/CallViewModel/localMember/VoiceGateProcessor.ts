/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type AudioProcessorOptions,
  type Track,
  type TrackProcessor,
} from "livekit-client";

import workletUrl from "./voiceGate.worklet.ts?worker&url";
import { VOICE_GATE_PROCESSOR } from "./LookaheadGate.ts";

/** The RMS volumes, from 0 to 1, that open the gate and keep it open. */
export interface GateThresholds {
  open: number;
  close: number;
}

/**
 * Sends the microphone through a {@link LookaheadGate} running on the audio
 * thread.
 */
export class VoiceGateProcessor implements TrackProcessor<
  Track.Kind.Audio,
  AudioProcessorOptions
> {
  public readonly name = "voice-activity-gate";
  public processedTrack?: MediaStreamTrack;

  private context?: AudioContext;
  private node?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;

  public constructor(private thresholds: GateThresholds) {}

  public async init({
    track,
    audioContext,
  }: AudioProcessorOptions): Promise<void> {
    await audioContext.audioWorklet.addModule(workletUrl);
    this.context = audioContext;
    this.node = new AudioWorkletNode(audioContext, VOICE_GATE_PROCESSOR, {
      channelCount: 1,
      channelCountMode: "explicit",
      outputChannelCount: [1],
    });
    this.setThresholds(this.thresholds);
    const destination = audioContext.createMediaStreamDestination();
    this.node.connect(destination);
    this.processedTrack = destination.stream.getAudioTracks()[0];
    this.connect(track);
  }

  // Keeps the same processed track, so the sender carries on uninterrupted.
  public async restart({ track }: { track: MediaStreamTrack }): Promise<void> {
    this.source?.disconnect();
    this.connect(track);
    return Promise.resolve();
  }

  public async destroy(): Promise<void> {
    this.source?.disconnect();
    this.node?.disconnect();
    this.source = undefined;
    this.node = undefined;
    return Promise.resolve();
  }

  public setThresholds(thresholds: GateThresholds): void {
    this.thresholds = thresholds;
    if (!this.node || !this.context) return;
    const now = this.context.currentTime;
    this.node.parameters.get("open")?.setValueAtTime(thresholds.open, now);
    this.node.parameters.get("close")?.setValueAtTime(thresholds.close, now);
  }

  private connect(track: MediaStreamTrack): void {
    if (!this.node || !this.context) return;
    this.source = this.context.createMediaStreamSource(
      new MediaStream([track]),
    );
    this.source.connect(this.node);
  }
}
