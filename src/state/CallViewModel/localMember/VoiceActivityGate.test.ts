/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LocalAudioTrack } from "livekit-client";
import { BehaviorSubject } from "rxjs";

import { ObservableScope } from "../../ObservableScope";
import { MIN_DECIBELS, volumeForDecibels } from "../../MicrophoneLevel";
import {
  type GateDependencies,
  gateMicrophoneByVolume,
} from "./VoiceActivityGate";
import { type GateThresholds } from "./VoiceGateProcessor";

let scope: ObservableScope;

beforeEach(() => {
  scope = new ObservableScope();
});

afterEach(() => {
  scope.end();
});

describe("gateMicrophoneByVolume", () => {
  it("sends the microphone through the gate when there is a threshold", async () => {
    const { track, processors } = setup(-40);
    await settle();
    expect(track.setProcessor).toHaveBeenCalledWith(processors[0]);
  });

  it("opens at the threshold and closes 3 dB below it", async () => {
    const { processors } = setup(-40);
    await settle();
    expect(processors[0].thresholds).toEqual({
      open: volumeForDecibels(-40),
      close: volumeForDecibels(-43),
    });
  });

  it("leaves the microphone alone when the threshold is the minimum", async () => {
    const { track } = setup(MIN_DECIBELS);
    await settle();
    expect(track.setProcessor).not.toHaveBeenCalled();
  });

  it("follows the threshold without rebuilding the gate", async () => {
    const { threshold$, processors, track } = setup(-40);
    await settle();
    threshold$.next(-60);
    await settle();
    expect(processors).toHaveLength(1);
    expect(track.setProcessor).toHaveBeenCalledTimes(1);
    expect(processors[0].thresholds.open).toBe(volumeForDecibels(-60));
  });

  it("removes the gate and its audio context when the threshold is turned off", async () => {
    const { threshold$, track, contexts } = setup(-40);
    await settle();
    threshold$.next(MIN_DECIBELS);
    await settle();
    expect(track.stopProcessor).toHaveBeenCalled();
    expect(contexts[0].close).toHaveBeenCalled();
  });

  it("removes the gate when the scope ends", async () => {
    const { track } = setup(-40);
    await settle();
    scope.end();
    await settle();
    expect(track.stopProcessor).toHaveBeenCalled();
  });

  it("waits for audio to be allowed to run before gating", async () => {
    let resume!: () => void;
    const { track } = setup(-40, new Promise<void>((r) => (resume = r)));
    await settle();
    expect(track.setProcessor).not.toHaveBeenCalled();
    resume();
    await settle();
    expect(track.setProcessor).toHaveBeenCalled();
  });

  it("does not gate a microphone it has already let go of", async () => {
    let resume!: () => void;
    const { track, contexts } = setup(
      -40,
      new Promise<void>((r) => (resume = r)),
    );
    scope.end();
    resume();
    await settle();
    expect(track.setProcessor).not.toHaveBeenCalled();
    expect(contexts[0].close).toHaveBeenCalled();
  });
});

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setup(
  threshold: number,
  resumed: Promise<void> = Promise.resolve(),
): {
  track: {
    setProcessor: ReturnType<typeof vi.fn>;
    stopProcessor: ReturnType<typeof vi.fn>;
  };
  threshold$: BehaviorSubject<number>;
  processors: { thresholds: GateThresholds }[];
  contexts: { close: ReturnType<typeof vi.fn> }[];
} {
  let current: unknown;
  const track = {
    setAudioContext: vi.fn(),
    setProcessor: vi.fn(async (processor: unknown) => {
      current = processor;
      return Promise.resolve();
    }),
    stopProcessor: vi.fn(async () => {
      current = undefined;
      return Promise.resolve();
    }),
    getProcessor: (): unknown => current,
  };
  const processors: { thresholds: GateThresholds }[] = [];
  const contexts: { close: ReturnType<typeof vi.fn> }[] = [];
  const dependencies = {
    createProcessor: (thresholds: GateThresholds) => {
      const processor = {
        thresholds,
        setThresholds(next: GateThresholds): void {
          processor.thresholds = next;
        },
      };
      processors.push(processor);
      return processor;
    },
    createAudioContext: () => {
      const context = {
        resume: async (): Promise<void> => resumed,
        close: vi.fn(async () => Promise.resolve()),
      };
      contexts.push(context);
      return context;
    },
  } as unknown as GateDependencies;
  const threshold$ = new BehaviorSubject(threshold);
  gateMicrophoneByVolume(
    scope,
    new BehaviorSubject(track as unknown as LocalAudioTrack),
    threshold$,
    dependencies,
  );
  return { track, threshold$, processors, contexts };
}
