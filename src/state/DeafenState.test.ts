/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BehaviorSubject } from "rxjs";

import { DeafenState } from "./DeafenState";
import { ObservableScope } from "./ObservableScope";

let scope: ObservableScope;

beforeEach(() => {
  scope = new ObservableScope();
});

afterEach(() => {
  scope.end();
});

describe("DeafenState", () => {
  it("starts out hearing the call", () => {
    const { deafen } = setup(true);
    expect(deafen.deafened$.value).toBe(false);
  });

  it("mutes the microphone on deafening", () => {
    const { deafen, microphone$ } = setup(true);
    deafen.toggle();
    expect(deafen.deafened$.value).toBe(true);
    expect(microphone$.value).toBe(false);
  });

  it("unmutes the microphone on undeafening if it was on before", () => {
    const { deafen, microphone$ } = setup(true);
    deafen.toggle();
    deafen.toggle();
    expect(deafen.deafened$.value).toBe(false);
    expect(microphone$.value).toBe(true);
  });

  it("leaves a muted microphone muted on undeafening", () => {
    const { deafen, microphone$ } = setup(false);
    deafen.toggle();
    deafen.toggle();
    expect(microphone$.value).toBe(false);
  });

  it("undeafens when the microphone is unmuted", () => {
    const { deafen, microphone$ } = setup(true);
    deafen.toggle();
    microphone$.next(true);
    expect(deafen.deafened$.value).toBe(false);
  });

  it("still deafens when the microphone can't be controlled", () => {
    const microphone$ = new BehaviorSubject(false);
    const deafen = new DeafenState(scope, {
      enabled$: microphone$,
      setEnabled$: new BehaviorSubject(null),
    });
    deafen.toggle();
    expect(deafen.deafened$.value).toBe(true);
  });
});

function setup(microphoneEnabled: boolean): {
  deafen: DeafenState;
  microphone$: BehaviorSubject<boolean>;
} {
  const microphone$ = new BehaviorSubject(microphoneEnabled);
  const deafen = new DeafenState(scope, {
    enabled$: microphone$,
    setEnabled$: new BehaviorSubject((enabled: boolean) =>
      microphone$.next(enabled),
    ),
  });
  return { deafen, microphone$ };
}
