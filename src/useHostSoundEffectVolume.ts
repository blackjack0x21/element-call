/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useEffect } from "react";

import { useHostBridge } from "./HostBridge";
import { soundEffectVolume } from "./settings/settings";

/** Applies the sound effect volume the host asks for. */
export const useHostSoundEffectVolume = (): void => {
  const hostBridge = useHostBridge();

  useEffect(() => {
    const subscription = hostBridge.soundEffectVolume$.subscribe(
      ({ data, reply }) => {
        if (typeof data.volume === "number" && Number.isFinite(data.volume))
          soundEffectVolume.setValue(Math.min(Math.max(data.volume, 0), 1));
        reply();
      },
    );
    return (): void => subscription.unsubscribe();
  }, [hostBridge]);
};
