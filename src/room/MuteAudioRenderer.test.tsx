/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { render } from "@testing-library/react";
import { act } from "react";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { MuteAudioRenderer } from "./MuteAudioRenderer";
import { useAudioContext } from "../useAudioContext";
import { type MuteStates } from "../state/MuteStates";

vi.mock("../useAudioContext");
vi.mock("../soundUtils");

const playSound = vi.fn();
let microphone$: BehaviorSubject<boolean>;
let deafened$: BehaviorSubject<boolean>;
let muteStates: MuteStates;

beforeEach(() => {
  playSound.mockReset();
  vi.mocked(useAudioContext).mockReturnValue({
    playSound,
    playSoundLooping: vi.fn(),
    soundDuration: {},
  });
  microphone$ = new BehaviorSubject(true);
  deafened$ = new BehaviorSubject(false);
  muteStates = {
    audio: { enabled$: microphone$ },
    deafen: { deafened$ },
  } as unknown as MuteStates;
});

afterEach(() => {
  vi.clearAllMocks();
});

test("plays a sound when the microphone is muted and unmuted", () => {
  render(<MuteAudioRenderer muteStates={muteStates} />);
  expect(playSound).not.toHaveBeenCalled();

  act(() => microphone$.next(false));
  expect(playSound).toHaveBeenLastCalledWith("mute");
  act(() => microphone$.next(true));
  expect(playSound).toHaveBeenLastCalledWith("unmute");
});

test("plays a sound when the user deafens and undeafens", () => {
  render(<MuteAudioRenderer muteStates={muteStates} />);

  act(() => deafened$.next(true));
  expect(playSound).toHaveBeenLastCalledWith("deafen");
  act(() => deafened$.next(false));
  expect(playSound).toHaveBeenLastCalledWith("undeafen");
});
