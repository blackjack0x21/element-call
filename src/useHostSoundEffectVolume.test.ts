/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { act, renderHook } from "@testing-library/react";
import { createElement, type FC, type PropsWithChildren } from "react";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useHostSoundEffectVolume } from "./useHostSoundEffectVolume";
import {
  type HostBridge,
  HostBridgeProvider,
  type HostRequest,
  nullHostBridge,
} from "./HostBridge";
import { soundEffectVolume } from "./settings/settings";

describe("useHostSoundEffectVolume", () => {
  let soundEffectVolume$: Subject<HostRequest<{ volume?: number }>>;
  let wrapper: FC<PropsWithChildren>;

  beforeEach(() => {
    soundEffectVolume.setValue(0.5);
    soundEffectVolume$ = new Subject();
    const hostBridge: HostBridge = { ...nullHostBridge, soundEffectVolume$ };
    wrapper = ({ children }) =>
      createElement(HostBridgeProvider, { value: hostBridge }, children);
    renderHook(() => useHostSoundEffectVolume(), { wrapper });
  });

  test.each([
    { asked: 0.8, applied: 0.8 },
    { asked: 0, applied: 0 },
    { asked: 3, applied: 1 },
    { asked: -1, applied: 0 },
  ])("applies a request for $asked as $applied", ({ asked, applied }) => {
    const reply = vi.fn();
    act(() => soundEffectVolume$.next({ data: { volume: asked }, reply }));
    expect(soundEffectVolume.value$.value).toBe(applied);
    expect(reply).toHaveBeenCalledOnce();
  });

  test.each([{}, { volume: NaN }, { volume: "loud" as unknown as number }])(
    "ignores the request %j",
    (data) => {
      const reply = vi.fn();
      act(() => soundEffectVolume$.next({ data, reply }));
      expect(soundEffectVolume.value$.value).toBe(0.5);
      expect(reply).toHaveBeenCalledOnce();
    },
  );
});
