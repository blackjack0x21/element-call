/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type ReactNode, useEffect } from "react";

import { type MuteStates } from "../state/MuteStates";
import { muteSoundEffects$ } from "../state/MuteSoundEffects";
import muteMp3 from "../sound/mute.mp3";
import muteOgg from "../sound/mute.ogg";
import unmuteMp3 from "../sound/unmute.mp3";
import unmuteOgg from "../sound/unmute.ogg";
import deafenMp3 from "../sound/deafen.mp3";
import deafenOgg from "../sound/deafen.ogg";
import undeafenMp3 from "../sound/undeafen.mp3";
import undeafenOgg from "../sound/undeafen.ogg";
import { useAudioContext } from "../useAudioContext";
import { prefetchSounds } from "../soundUtils";
import { useLatest } from "../useLatest";

export const muteAudioSounds = prefetchSounds({
  mute: { mp3: muteMp3, ogg: muteOgg },
  unmute: { mp3: unmuteMp3, ogg: unmuteOgg },
  deafen: { mp3: deafenMp3, ogg: deafenOgg },
  undeafen: { mp3: undeafenMp3, ogg: undeafenOgg },
});

export function MuteAudioRenderer({
  muteStates,
  muted,
}: {
  muteStates: MuteStates;
  muted?: boolean;
}): ReactNode {
  const audioEngineCtx = useAudioContext({
    sounds: muteAudioSounds,
    latencyHint: "interactive",
    muted,
  });
  const audioEngineRef = useLatest(audioEngineCtx);

  useEffect(() => {
    const sub = muteSoundEffects$(
      muteStates.audio.enabled$,
      muteStates.deafen.deafened$,
    ).subscribe((sound) => void audioEngineRef.current?.playSound(sound));
    return (): void => sub.unsubscribe();
  }, [audioEngineRef, muteStates]);

  return <></>;
}
