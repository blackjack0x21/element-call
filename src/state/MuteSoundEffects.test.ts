/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, test } from "vitest";

import { withTestScheduler } from "../utils/test";
import { muteSoundEffects$ } from "./MuteSoundEffects";

describe("muteSoundEffects$", () => {
  test("is silent until something changes", () => {
    withTestScheduler(({ behavior, expectObservable }) => {
      expectObservable(
        muteSoundEffects$(
          behavior("a", { a: true }),
          behavior("a", { a: false }),
        ),
      ).toBe("-");
    });
  });

  test("sounds out muting and unmuting", () => {
    withTestScheduler(({ behavior, expectObservable }) => {
      expectObservable(
        muteSoundEffects$(
          behavior("a-b-a", { a: true, b: false }),
          behavior("a", { a: false }),
        ),
      ).toBe("--m-u", { m: "mute", u: "unmute" });
    });
  });

  test("sounds out deafening without also sounding out the mute", () => {
    withTestScheduler(({ behavior, expectObservable }) => {
      expectObservable(
        muteSoundEffects$(
          behavior("a--b", { a: true, b: false }),
          behavior("a-b", { a: false, b: true }),
        ),
      ).toBe("--d", { d: "deafen" });
    });
  });

  test("sounds out the microphone again once the deafen change has settled", () => {
    withTestScheduler(({ behavior, expectObservable }) => {
      expectObservable(
        muteSoundEffects$(
          behavior("a--b 1s c 5ms d", { a: true, b: false, c: true, d: false }),
          behavior("a-b 1s c", { a: false, b: true, c: false }),
        ),
      ).toBe("--d 1s u 6ms m", {
        d: "deafen",
        u: "undeafen",
        m: "mute",
      });
    });
  });

  test("sounds out only the undeafening when unmuting undeafens, then every change", () => {
    withTestScheduler(({ behavior, expectObservable }) => {
      expectObservable(
        muteSoundEffects$(
          behavior("a-b---c-d", { a: false, b: true, c: false, d: true }),
          behavior("a-b", { a: true, b: false }),
        ),
      ).toBe("--U---m-n", {
        U: "undeafen",
        m: "mute",
        n: "unmute",
      });
    });
  });

  test("sounds out unmuting after deafening and undeafening while already muted", () => {
    withTestScheduler(({ behavior, expectObservable }) => {
      expectObservable(
        muteSoundEffects$(
          behavior("a-----b", { a: false, b: true }),
          behavior("a-b-c", { a: false, b: true, c: false }),
        ),
      ).toBe("--d-u-n", { d: "deafen", u: "undeafen", n: "unmute" });
    });
  });
});
