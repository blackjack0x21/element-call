/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { BehaviorSubject, filter, pairwise } from "rxjs";

import { type Behavior } from "./Behavior";
import { type ObservableScope } from "./ObservableScope";

interface Microphone {
  enabled$: Behavior<boolean>;
  setEnabled$: Behavior<((enabled: boolean) => void) | null>;
}

/**
 * Whether the user has stopped hearing the call. Deafening also mutes the
 * microphone, and undeafening restores it to how it was.
 */
export class DeafenState {
  private readonly deafenedSubject$ = new BehaviorSubject(false);
  public readonly deafened$: Behavior<boolean> = this.deafenedSubject$;

  private microphoneWasEnabled = false;

  public constructor(
    scope: ObservableScope,
    private readonly microphone: Microphone,
  ) {
    // Talking without hearing anyone isn't a state worth keeping.
    microphone.enabled$
      .pipe(
        pairwise(),
        filter(([was, is]) => !was && is),
        scope.bind(),
      )
      .subscribe(() => this.deafenedSubject$.next(false));
  }

  public readonly toggle = (): void => {
    const setMicrophoneEnabled = this.microphone.setEnabled$.value;
    if (this.deafenedSubject$.value) {
      this.deafenedSubject$.next(false);
      if (this.microphoneWasEnabled) setMicrophoneEnabled?.(true);
    } else {
      this.microphoneWasEnabled = this.microphone.enabled$.value;
      this.deafenedSubject$.next(true);
      setMicrophoneEnabled?.(false);
    }
  };
}
