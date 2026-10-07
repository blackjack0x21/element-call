/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type LocalAudioTrack } from "livekit-client";
import {
  combineLatest,
  distinctUntilChanged,
  map,
  NEVER,
  Observable,
  switchMap,
} from "rxjs";
import { logger } from "matrix-js-sdk/lib/logger";

import { type Behavior } from "../../Behavior.ts";
import { type ObservableScope } from "../../ObservableScope.ts";
import { volumeForLevel } from "../../MicrophoneLevel.ts";
import {
  type GateThresholds,
  VoiceGateProcessor,
} from "./VoiceGateProcessor.ts";

// Speech trailing off, such as the end of an "s", is quieter than it started.
// Once the gate is open, it stays open down to this share of the threshold.
const HYSTERESIS = 0.7;

/** What the gate needs from a processor, so that tests can stand in for the audio graph. */
export interface GateProcessor {
  setThresholds: (thresholds: GateThresholds) => void;
}

export interface GateDependencies {
  createProcessor: (
    thresholds: GateThresholds,
  ) => GateProcessor & Parameters<LocalAudioTrack["setProcessor"]>[0];
  createAudioContext: () => AudioContext;
}

const browserDependencies: GateDependencies = {
  createProcessor: (thresholds) => new VoiceGateProcessor(thresholds),
  createAudioContext: () => new AudioContext({ latencyHint: "interactive" }),
};

/**
 * Silences the microphone while it is quieter than a threshold, on the meter's
 * scale. Passing a threshold of 0 disables the gate. The microphone is never
 * muted as far as LiveKit or other participants are concerned; it just sends
 * silence.
 *
 * @param track$ The local microphone track, if there is one.
 * @param threshold$ The meter level, from 0 to 1, that speech must reach.
 */
export function gateMicrophoneByVolume(
  scope: ObservableScope,
  track$: Behavior<LocalAudioTrack | null>,
  threshold$: Behavior<number>,
  dependencies: GateDependencies = browserDependencies,
): void {
  const enabled$ = threshold$.pipe(
    map((threshold) => threshold > 0),
    distinctUntilChanged(),
  );
  combineLatest([track$, enabled$])
    .pipe(
      switchMap(([track, enabled]) =>
        track && enabled ? gate$(track, threshold$, dependencies) : NEVER,
      ),
      scope.bind(),
    )
    .subscribe();
}

function gate$(
  track: LocalAudioTrack,
  threshold$: Behavior<number>,
  { createProcessor, createAudioContext }: GateDependencies,
): Observable<never> {
  return new Observable<never>(() => {
    const context = createAudioContext();
    const processor = createProcessor(thresholdsFor(threshold$.value));
    const thresholdSubscription = threshold$.subscribe((threshold) =>
      processor.setThresholds(thresholdsFor(threshold)),
    );
    let ended = false;

    // A context that isn't allowed to run yet would send silence, so the
    // microphone stays ungated until it does.
    const applied = context
      .resume()
      .then(async () => {
        if (ended) return;
        track.setAudioContext(context);
        await track.setProcessor(processor);
      })
      .catch((e) => logger.warn("Failed to gate the microphone", e));

    return (): void => {
      ended = true;
      thresholdSubscription.unsubscribe();
      void applied
        .then(async () => {
          if (track.getProcessor() === processor) await track.stopProcessor();
          await context.close();
        })
        .catch((e) => logger.warn("Failed to ungate the microphone", e));
    };
  });
}

function thresholdsFor(level: number): GateThresholds {
  return {
    open: volumeForLevel(level),
    close: volumeForLevel(level * HYSTERESIS),
  };
}
