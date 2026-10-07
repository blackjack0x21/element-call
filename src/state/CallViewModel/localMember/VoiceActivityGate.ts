/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type LocalAudioTrack } from "livekit-client";
import { combineLatest, Observable, switchMap } from "rxjs";

import { type Behavior } from "../../Behavior.ts";
import { type ObservableScope } from "../../ObservableScope.ts";
import { LEVEL_SCALE, segmentsForVolume } from "../../MicrophoneLevel.ts";

const SAMPLE_INTERVAL_MS = 50;
// Keeps the gate open after speech, so trailing sounds aren't chopped off.
const HOLD_MS = 500;
// Speech trailing off, such as the end of an "s", is quieter than it started.
// Once the gate is open, it stays open down to this share of the threshold.
const HYSTERESIS = 0.7;

export interface LevelMeter {
  /** The current volume, from 0 (silence) to 1 (full scale). */
  level: () => number;
  stop: () => void;
}

/**
 * Silences the microphone while it is quieter than a threshold. Passing a
 * threshold of 0 disables the gate. The microphone is never muted as far as
 * LiveKit or other participants are concerned; it just sends silence.
 *
 * @param track$ The local microphone track, if there is one.
 * @param threshold$ The volume, from 0 to 1, that speech must reach.
 */
export function gateMicrophoneByVolume(
  scope: ObservableScope,
  track$: Behavior<LocalAudioTrack | null>,
  threshold$: Behavior<number>,
  createMeter: (track: MediaStreamTrack) => LevelMeter = createLevelMeter,
): void {
  combineLatest([track$, threshold$])
    .pipe(
      switchMap(([track, threshold]) =>
        track && threshold > 0
          ? gate$(track, threshold, createMeter)
          : new Observable<never>(),
      ),
      scope.bind(),
    )
    .subscribe();
}

function gate$(
  track: LocalAudioTrack,
  threshold: number,
  createMeter: (track: MediaStreamTrack) => LevelMeter,
): Observable<never> {
  return new Observable<never>(() => {
    let metered: MediaStreamTrack | undefined;
    let meter: LevelMeter | undefined;
    let lastLoudAt = -Infinity;

    const sample = (): void => {
      const current = track.mediaStreamTrack;
      // The track is replaced when the microphone restarts.
      if (current !== metered) {
        meter?.stop();
        meter = createMeter(current);
        metered = current;
      }
      const now = performance.now();
      const open = now - lastLoudAt <= HOLD_MS;
      if (meter!.level() >= (open ? threshold * HYSTERESIS : threshold))
        lastLoudAt = now;
      // An explicit mute owns the track's enabled state.
      if (!track.isMuted) current.enabled = now - lastLoudAt <= HOLD_MS;
    };

    const interval = setInterval(sample, SAMPLE_INTERVAL_MS);
    return (): void => {
      clearInterval(interval);
      meter?.stop();
      if (metered && !track.isMuted) metered.enabled = true;
    };
  });
}

/**
 * Measures a track's volume through a clone, which keeps flowing even while
 * the original is disabled by the gate.
 */
function createLevelMeter(track: MediaStreamTrack): LevelMeter {
  const clone = track.clone();
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  context.createMediaStreamSource(new MediaStream([clone])).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  return {
    level: (): number => {
      analyser.getFloatTimeDomainData(samples);
      return volumeLevel(samples);
    },
    stop: (): void => {
      clone.stop();
      void context.close();
    },
  };
}

/**
 * Converts audio samples to a level from 0 to 1, on the same scale as the
 * live microphone meter so that what it shows is what the gate acts on.
 */
export function volumeLevel(samples: Float32Array): number {
  let sumOfSquares = 0;
  for (const sample of samples) sumOfSquares += sample * sample;
  const rms = Math.sqrt(sumOfSquares / samples.length);
  return segmentsForVolume(rms) / LEVEL_SCALE;
}
