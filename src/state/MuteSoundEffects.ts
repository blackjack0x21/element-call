/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  concat,
  distinctUntilChanged,
  filter,
  map,
  of,
  pairwise,
  scan,
  skip,
  startWith,
  switchMap,
  timer,
  withLatestFrom,
  type MonoTypeOperatorFunction,
  type Observable,
} from "rxjs";

export type MuteSound = "mute" | "unmute" | "deafen" | "undeafen";

/**
 * How long after (un)deafening the microphone is expected to finish following.
 */
export const DEAFEN_SETTLE_MS = 1000;

/**
 * The sound to play whenever the user mutes, unmutes, deafens or undeafens.
 * The microphone change that accompanies deafening stays silent, and so does
 * the state the streams start in.
 */
export function muteSoundEffects$(
  microphoneEnabled$: Observable<boolean>,
  deafened$: Observable<boolean>,
): Observable<MuteSound> {
  return deafened$.pipe(
    distinctUntilChanged(),
    withLatestFrom(microphoneEnabled$),
    // Whether the microphone was on when the user deafened, which is whether
    // deafening switched it off and undeafening will switch it back on
    scan(
      (previous, [deafened, microphoneEnabled], index) => ({
        deafened,
        index,
        microphoneFollows: deafened
          ? microphoneEnabled
          : previous.microphoneFollows,
      }),
      { deafened: false, index: -1, microphoneFollows: false },
    ),
    switchMap(({ deafened, index, microphoneFollows }) =>
      index === 0
        ? microphoneSounds$(microphoneEnabled$, deafened)
        : concat(
            of<MuteSound>(deafened ? "deafen" : "undeafen"),
            microphoneSoundsAfterDeafenChange$(
              microphoneEnabled$,
              deafened,
              microphoneFollows,
            ),
          ),
    ),
  );
}

function microphoneSounds$(
  microphoneEnabled$: Observable<boolean>,
  deafened: boolean,
): Observable<MuteSound> {
  return microphoneEnabled$.pipe(
    distinctUntilChanged(),
    skip(1),
    unmuteWhileDeafenedIsSilent(deafened),
    map(microphoneSound),
  );
}

/** Unmuting while deafened undeafens, which is sounded out in its place. */
function unmuteWhileDeafenedIsSilent(
  deafened: boolean,
): MonoTypeOperatorFunction<boolean> {
  return filter((enabled) => !(deafened && enabled));
}

function microphoneSound(enabled: boolean): MuteSound {
  return enabled ? "unmute" : "mute";
}

/**
 * Deafening mutes the microphone and undeafening may bring it back, a moment
 * later. That one change is already sounded out by the deafen sound, and
 * anything else is the user's own.
 */
function microphoneSoundsAfterDeafenChange$(
  microphoneEnabled$: Observable<boolean>,
  deafened: boolean,
  microphoneFollows: boolean,
): Observable<MuteSound> {
  const causedByDeafening = !deafened;
  const settling$ = timer(DEAFEN_SETTLE_MS).pipe(
    map(() => false),
    startWith(true),
  );
  return microphoneEnabled$.pipe(
    distinctUntilChanged(),
    pairwise(),
    withLatestFrom(settling$),
    filter(
      ([[was, is], settling], i) =>
        !(
          microphoneFollows &&
          settling &&
          i === 0 &&
          was !== causedByDeafening &&
          is === causedByDeafening
        ),
    ),
    map(([[, is]]) => is),
    unmuteWhileDeafenedIsSilent(deafened),
    map(microphoneSound),
  );
}
