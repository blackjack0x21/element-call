/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LocalAudioTrack } from "livekit-client";
import { BehaviorSubject } from "rxjs";

import { ObservableScope } from "../../ObservableScope";
import { LEVEL_SCALE, segmentsForVolume } from "../../MicrophoneLevel";
import { gateMicrophoneByVolume, volumeLevel } from "./VoiceActivityGate";

let scope: ObservableScope;

beforeEach(() => {
  vi.useFakeTimers();
  scope = new ObservableScope();
});

afterEach(() => {
  scope.end();
  vi.useRealTimers();
});

describe("gateMicrophoneByVolume", () => {
  it("silences the microphone while it is below the threshold", () => {
    const { mediaStreamTrack, level } = setup(0.5);
    level.value = 0.1;
    vi.advanceTimersByTime(1000);
    expect(mediaStreamTrack.enabled).toBe(false);
  });

  it("sends the microphone while it is above the threshold", () => {
    const { mediaStreamTrack, level } = setup(0.5);
    level.value = 0.8;
    vi.advanceTimersByTime(100);
    expect(mediaStreamTrack.enabled).toBe(true);
  });

  it("holds the gate open briefly after speech", () => {
    const { mediaStreamTrack, level } = setup(0.5);
    level.value = 0.8;
    vi.advanceTimersByTime(100);
    level.value = 0;
    vi.advanceTimersByTime(200);
    expect(mediaStreamTrack.enabled).toBe(true);
    vi.advanceTimersByTime(500);
    expect(mediaStreamTrack.enabled).toBe(false);
  });

  it("keeps the gate open for quieter sound once speech has started", () => {
    const { mediaStreamTrack, level } = setup(0.5);
    level.value = 0.8;
    vi.advanceTimersByTime(100);
    level.value = 0.4;
    vi.advanceTimersByTime(2000);
    expect(mediaStreamTrack.enabled).toBe(true);
    level.value = 0.3;
    vi.advanceTimersByTime(1000);
    expect(mediaStreamTrack.enabled).toBe(false);
  });

  it("needs the full threshold to open the gate", () => {
    const { mediaStreamTrack, level } = setup(0.5);
    level.value = 0.4;
    vi.advanceTimersByTime(1000);
    expect(mediaStreamTrack.enabled).toBe(false);
  });

  it("leaves the microphone alone when the threshold is 0", () => {
    const { mediaStreamTrack, level } = setup(0);
    level.value = 0;
    vi.advanceTimersByTime(1000);
    expect(mediaStreamTrack.enabled).toBe(true);
  });

  it("restores the microphone when the threshold is turned off", () => {
    const { mediaStreamTrack, level, threshold$ } = setup(0.5);
    level.value = 0;
    vi.advanceTimersByTime(1000);
    expect(mediaStreamTrack.enabled).toBe(false);
    threshold$.next(0);
    expect(mediaStreamTrack.enabled).toBe(true);
  });

  it("does not override an explicit mute", () => {
    const { mediaStreamTrack, track, level } = setup(0.5);
    track.isMuted = true;
    mediaStreamTrack.enabled = false;
    level.value = 0.8;
    vi.advanceTimersByTime(1000);
    expect(mediaStreamTrack.enabled).toBe(false);
  });

  it("stops measuring when the scope ends", () => {
    const { stop } = setup(0.5);
    vi.advanceTimersByTime(100);
    scope.end();
    expect(stop).toHaveBeenCalled();
  });
});

describe("volumeLevel", () => {
  it("is 0 for silence", () => {
    expect(volumeLevel(new Float32Array(16))).toBe(0);
  });

  it("is 1 for full scale", () => {
    expect(volumeLevel(new Float32Array(16).fill(1))).toBe(1);
  });

  it("matches the live microphone meter", () => {
    const volume = 0.25;
    expect(volumeLevel(new Float32Array(16).fill(volume))).toBe(
      segmentsForVolume(volume) / LEVEL_SCALE,
    );
  });
});

function setup(threshold: number): {
  mediaStreamTrack: { enabled: boolean };
  track: { isMuted: boolean };
  level: { value: number };
  stop: ReturnType<typeof vi.fn>;
  threshold$: BehaviorSubject<number>;
} {
  const mediaStreamTrack = { enabled: true };
  const track = { isMuted: false, mediaStreamTrack };
  const level = { value: 1 };
  const stop = vi.fn();
  const threshold$ = new BehaviorSubject(threshold);
  gateMicrophoneByVolume(
    scope,
    new BehaviorSubject(track as unknown as LocalAudioTrack),
    threshold$,
    () => ({ level: () => level.value, stop }),
  );
  return { mediaStreamTrack, track, level, stop, threshold$ };
}
