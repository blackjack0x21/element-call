/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useCallback, useLayoutEffect, useRef } from "react";
import { Root, Track, Range, Thumb } from "@radix-ui/react-slider";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";
import { type Observable } from "rxjs";

import styles from "./Slider.module.css";

interface Props {
  className?: string;
  label: string;
  value: number;
  /**
   * Event handler called when the value changes during an interaction.
   */
  onValueChange: (value: number) => void;
  /**
   * Event handler called when the value changes at the end of an interaction.
   * Useful when you only need to capture a final value to update a backend
   * service, or when you want to remember the last value that the user
   * "committed" to.
   */
  onValueCommit?: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  /**
   * Custom formatter for the tooltip label. If not provided, the value is
   * displayed as a percentage.
   */
  tooltipFormatter?: (value: number) => string;
  /**
   * A live reading, from 0 to 1 of the track, drawn behind the handle. For
   * showing what the slider is being compared against.
   */
  indicator$?: Observable<number>;
  /**
   * Whether to show the formatted value beside the slider, for when a tooltip
   * on the handle alone is not enough.
   */
  showValue?: boolean;
}

/**
 * A slider control allowing a value to be selected from a range.
 */
export const Slider: FC<Props> = ({
  className,
  label,
  value,
  onValueChange: onValueChangeProp,
  onValueCommit: onValueCommitProp,
  min,
  max,
  step,
  disabled,
  tooltipFormatter,
  indicator$,
  showValue,
}) => {
  const indicator = useRef<HTMLDivElement>(null);
  // Drawn straight into the DOM: a live reading changes many times a second.
  useLayoutEffect(() => {
    const element = indicator.current;
    if (!indicator$ || !element) return;
    const subscription = indicator$.subscribe((reading) => {
      element.style.inlineSize = `${Math.min(1, Math.max(0, reading)) * 100}%`;
    });
    return (): void => subscription.unsubscribe();
  }, [indicator$]);

  const onValueChange = useCallback(
    ([v]: number[]) => onValueChangeProp(v),
    [onValueChangeProp],
  );
  const onValueCommit = useCallback(
    ([v]: number[]) => onValueCommitProp?.(v),
    [onValueCommitProp],
  );

  const formattedValue = tooltipFormatter
    ? tooltipFormatter(value)
    : Math.round(value * 100).toString() + "%";

  const slider = (
    <Root
      className={classNames(!showValue && className, styles.slider)}
      value={[value]}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    >
      <Track className={styles.track}>
        <Range className={styles.highlight} />
        {indicator$ && (
          <div ref={indicator} aria-hidden className={styles.indicator} />
        )}
      </Track>
      {/* Note: This is expected not to be visible on mobile.*/}
      <Tooltip placement="top" label={formattedValue}>
        <Thumb
          className={styles.handle}
          aria-label={label}
          aria-valuetext={formattedValue}
        />
      </Tooltip>
    </Root>
  );

  return showValue ? (
    <div className={classNames(className, styles.withValue)}>
      {slider}
      <span className={styles.value} aria-hidden>
        {formattedValue}
      </span>
    </div>
  ) : (
    slider
  );
};
